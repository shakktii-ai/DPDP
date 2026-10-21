import dns from 'dns';
import fs from 'fs';
import path from 'path';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

// Auto-load .env.worker (priority for local fallback worker) or .env.local
const envFilesToTry = ['.env.worker', '.env.local', '.env'];
let activeEnvFile = null;

for (const envFile of envFilesToTry) {
  try {
    const envPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      if (!activeEnvFile) activeEnvFile = envFile;
      const envContent = fs.readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  } catch (err) {}
}

// Auto-detect standard Docker Playwright browser path
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/ms-playwright')) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/ms-playwright';
}

import connectDB from '../lib/mongodb.js';
import { claimNextQueuedJob, reconcileStaleJobs, getQueueMetrics } from '../lib/worker-queue.js';
import { executeInspectionRun } from '../lib/browser-worker.js';
import TestRun from '../models/TestRun.js';

const isLocalWorker = process.platform === 'win32' || !process.env.RAILWAY_ENVIRONMENT;
const WORKER_TYPE = isLocalWorker ? 'local-fallback' : 'railway-primary';
const WORKER_ID = process.env.WORKER_ID || `worker-${WORKER_TYPE}-${process.pid}-${Date.now().toString(36)}`;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS, 10) || 3000;
const RECONCILE_INTERVAL_MS = parseInt(process.env.RECONCILE_INTERVAL_MS, 10) || 60000;

let isShuttingDown = false;
let isProcessingJob = false;
let currentJobId = null;
let lastReconcileTime = 0;

async function verifyBrowserPreflight() {
  console.log(`[WorkerDaemon ${WORKER_ID}] Verifying Playwright Chromium browser environment...`);
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const version = browser.version();
    await browser.close();
    console.log(`[WorkerDaemon ${WORKER_ID}] Chromium preflight PASSED (Chromium v${version}). Browser ready.`);
    return true;
  } catch (err) {
    console.error(`\n========================================================`);
    console.error(`[WorkerDaemon ${WORKER_ID} ERROR] Playwright Chromium preflight check FAILED!`);
    console.error(`Error details: ${err.message}`);
    console.error(`Browser path evaluated: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'default (~/.cache/ms-playwright)'}`);
    console.error(`Remediation:`);
    console.error(`  - Docker deployment: Use base image 'mcr.microsoft.com/playwright:v1.64.1-noble'`);
    console.error(`  - Native Linux build: Run 'npx playwright install --with-deps chromium' in your build phase.`);
    console.error(`========================================================\n`);
    return false;
  }
}

async function startWorkerDaemon() {
  console.log(`[WorkerDaemon ${WORKER_ID}] Connecting to DPDP Vault database...`);
  await connectDB();
  console.log(`[WorkerDaemon ${WORKER_ID}] Online and listening for queued Playwright inspection jobs.`);

  // Verify Chromium is available before claiming work
  await verifyBrowserPreflight();

  const initialMetrics = await getQueueMetrics();
  console.log(`[WorkerDaemon ${WORKER_ID}] Initial queue metrics: Queued=${initialMetrics.queued}, Running=${initialMetrics.running}, Completed=${initialMetrics.completed}, Failed=${initialMetrics.failed}`);

  while (!isShuttingDown) {
    try {
      // Periodically reconcile stale jobs
      if (Date.now() - lastReconcileTime > RECONCILE_INTERVAL_MS) {
        lastReconcileTime = Date.now();
        const { reconciledQueued, reconciledRunning } = await reconcileStaleJobs();
        if (reconciledQueued > 0 || reconciledRunning > 0) {
          console.log(`[WorkerDaemon ${WORKER_ID}] Reconciled stale runs: ${reconciledQueued} queued, ${reconciledRunning} running.`);
        }
      }

      // Claim next job atomically
      const job = await claimNextQueuedJob(WORKER_ID);
      if (job) {
        isProcessingJob = true;
        currentJobId = job._id;
        console.log(`\n========================================================`);
        console.log(`[WorkerDaemon ${WORKER_ID}] Claimed TestRun: ${job._id} (Target: ${job.targetId?.approvedDomain || job.targetId})`);
        console.log(`========================================================`);

        const startTime = Date.now();
        try {
          await executeInspectionRun(job._id, job.runOptions || {});
          console.log(`[WorkerDaemon ${WORKER_ID}] Completed TestRun: ${job._id} in ${((Date.now() - startTime) / 1000).toFixed(1)}s.`);
        } catch (jobErr) {
          console.error(`[WorkerDaemon ${WORKER_ID}] Error executing TestRun ${job._id}:`, jobErr.message);
        } finally {
          isProcessingJob = false;
          currentJobId = null;
        }
      } else {
        // Sleep before next poll
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (loopErr) {
      console.error(`[WorkerDaemon ${WORKER_ID}] Error in worker loop:`, loopErr.message);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  console.log(`[WorkerDaemon ${WORKER_ID}] Clean shutdown completed.`);
}

// Graceful shutdown handling with active job release
async function handleShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[WorkerDaemon ${WORKER_ID}] ${signal} received. Shutting down gracefully...`);

  if (isProcessingJob && currentJobId) {
    console.log(`[WorkerDaemon ${WORKER_ID}] Releasing active job ${currentJobId} back to queue for other workers...`);
    try {
      const activeRun = await TestRun.findById(currentJobId);
      if (activeRun && ['starting_browser', 'running', 'in_progress', 'inspecting_website'].includes(activeRun.status)) {
        if ((activeRun.retryCount || 0) < (activeRun.maxRetries || 2)) {
          await TestRun.findByIdAndUpdate(currentJobId, {
            status: 'queued',
            workerId: null,
            leaseExpiresAt: null,
            currentStep: 'Worker stopped during execution. Safely re-queued for fallback pickup.',
          });
          console.log(`[WorkerDaemon ${WORKER_ID}] Job ${currentJobId} successfully re-queued.`);
        } else {
          await TestRun.findByIdAndUpdate(currentJobId, {
            status: 'failed',
            errorMessage: 'Worker was stopped during test execution and retry limit was reached.',
            leaseExpiresAt: null,
            endTime: new Date(),
          });
        }
      }
    } catch (e) {
      console.error(`[WorkerDaemon ${WORKER_ID}] Error releasing job on shutdown:`, e.message);
    }
  }

  process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

startWorkerDaemon().catch((err) => {
  console.error(`[WorkerDaemon Fatal Error]:`, err);
  process.exit(1);
});
