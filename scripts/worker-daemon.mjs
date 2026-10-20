import dns from 'dns';
import fs from 'fs';
import path from 'path';

try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {}

// Auto-load .env.local if not already provided by environment
if (!process.env.MONGODB_URI) {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
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

import connectDB from '../lib/mongodb.js';
import { claimNextQueuedJob, reconcileStaleJobs, getQueueMetrics } from '../lib/worker-queue.js';
import { executeInspectionRun } from '../lib/browser-worker.js';

const WORKER_ID = `worker-daemon-${process.pid}-${Date.now().toString(36)}`;
const POLL_INTERVAL_MS = 3000;
const RECONCILE_INTERVAL_MS = 60000;

let isShuttingDown = false;
let isProcessingJob = false;
let lastReconcileTime = 0;

async function startWorkerDaemon() {
  console.log(`[WorkerDaemon ${WORKER_ID}] Connecting to DPDP Vault database...`);
  await connectDB();
  console.log(`[WorkerDaemon ${WORKER_ID}] Online and listening for queued Playwright inspection jobs.`);

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

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log(`\n[WorkerDaemon ${WORKER_ID}] SIGINT received. Shutting down gracefully...`);
  isShuttingDown = true;
  if (!isProcessingJob) process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n[WorkerDaemon ${WORKER_ID}] SIGTERM received. Shutting down gracefully...`);
  isShuttingDown = true;
  if (!isProcessingJob) process.exit(0);
});

startWorkerDaemon().catch((err) => {
  console.error(`[WorkerDaemon Fatal Error]:`, err);
  process.exit(1);
});
