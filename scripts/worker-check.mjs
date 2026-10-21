import fs from 'fs';
import path from 'path';

// 1. Auto-load environment variables from .env.worker or .env.local
const envFilesToTry = ['.env.worker', '.env.local', '.env'];
let loadedEnvFile = null;

for (const envFile of envFilesToTry) {
  try {
    const envPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      if (!loadedEnvFile) loadedEnvFile = envFile;
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
  } catch (e) {}
}

import connectDB from '../lib/mongodb.js';
import TestRun from '../models/TestRun.js';
import Assessment from '../models/Assessment.js';
import { getQueueMetrics } from '../lib/worker-queue.js';

function maskString(str, visibleChars = 4) {
  if (!str) return '(not set)';
  if (str.length <= visibleChars * 2) return '****';
  return `${str.slice(0, visibleChars)}...${str.slice(-visibleChars)}`;
}

function maskMongoUri(uri) {
  if (!uri) return '(not set)';
  try {
    return uri.replace(/:([^@]+)@/, ':*****@');
  } catch {
    return maskString(uri, 8);
  }
}

async function runHealthCheck() {
  console.log('================================================================');
  console.log(' DPDP Vault — Local-First Worker (Primary) Health & Readiness Check');
  console.log('================================================================\n');

  let hasErrors = false;

  // 1. Check Environment
  console.log('--- 1. Environment Configuration ---');
  console.log(`Active config file: ${loadedEnvFile || 'system environment'}`);

  const requiredVars = [
    { name: 'MONGODB_URI', val: maskMongoUri(process.env.MONGODB_URI), required: true },
    { name: 'GEMINI_API_KEY', val: maskString(process.env.GEMINI_API_KEY, 6), required: true },
    { name: 'CLOUDINARY_CLOUD_NAME', val: process.env.CLOUDINARY_CLOUD_NAME || '(not set)', required: true },
    { name: 'CLOUDINARY_API_KEY', val: maskString(process.env.CLOUDINARY_API_KEY, 4), required: true },
    { name: 'CLOUDINARY_API_SECRET', val: maskString(process.env.CLOUDINARY_API_SECRET, 4), required: true },
    { name: 'JWT_SECRET', val: maskString(process.env.JWT_SECRET, 6), required: false },
  ];

  for (const item of requiredVars) {
    const isPresent = Boolean(process.env[item.name]);
    const status = isPresent ? '✓ PASS' : item.required ? '✗ FAIL' : '⚠ OPTIONAL';
    console.log(`  [${status}] ${item.name}: ${item.val}`);
    if (item.required && !isPresent) hasErrors = true;
  }
  console.log('');

  // 2. Check MongoDB Connectivity & Queue State
  console.log('--- 2. Database & Production Queue Connectivity ---');
  try {
    const startMs = Date.now();
    await connectDB();
    const pingMs = Date.now() - startMs;
    console.log(`  [✓ PASS] MongoDB Atlas connected successfully (${pingMs}ms).`);

    const metrics = await getQueueMetrics();
    console.log(`  [✓ PASS] Queue metrics fetched:`);
    console.log(`           - Queued (waiting for worker): ${metrics.queued}`);
    console.log(`           - Running (actively processing): ${metrics.running}`);
    console.log(`           - Completed: ${metrics.completed}`);
    console.log(`           - Failed: ${metrics.failed}`);

    // Check if any jobs are currently assigned to active workers
    const activeRuns = await TestRun.find({
      status: { $in: ['starting_browser', 'running', 'in_progress', 'inspecting_website'] }
    }).select('_id workerId workerRole status currentStep updatedAt');

    if (activeRuns.length > 0) {
      console.log(`  [INFO] Currently active jobs on cluster workers:`);
      for (const r of activeRuns) {
        console.log(`         - Run ${r._id} | Role: ${r.workerRole || 'unknown'} | Worker: ${r.workerId || 'unknown'} | Step: ${r.currentStep}`);
      }
    } else {
      console.log(`  [INFO] No runs currently in progress. Queue is ready.`);
    }
  } catch (dbErr) {
    console.error(`  [✗ FAIL] MongoDB connection error: ${dbErr.message}`);
    hasErrors = true;
  }
  console.log('');

  // 3. Check Dual-Worker Cluster & Priority Status
  console.log('--- 3. Dual-Worker Cluster & Failover Status ---');
  try {
    const { getClusterWorkerStatuses } = await import('../lib/worker-heartbeat.js');
    const cluster = await getClusterWorkerStatuses();
    console.log(`  Primary Local Worker:   ${cluster.localPrimaryActive ? '✓ ONLINE & PRIMARY (Preferred Priority Active)' : '⚠ OFFLINE (Railway backup will auto-claim)'}`);
    console.log(`  Backup Railway Worker:  ${cluster.railwayBackupActive ? '✓ ONLINE & STANDBY (Ready to failover)' : '⚠ OFFLINE / Not reporting'}`);

    if (cluster.allWorkers.length > 0) {
      console.log(`  Registered Workers in Cluster:`);
      for (const w of cluster.allWorkers) {
        const statusBadge = w.isHealthy ? 'HEALTHY' : 'STALE/OFFLINE';
        console.log(`    - [${w.role}] ${w.workerId} (${w.status} / ${statusBadge}) | Last heartbeat: ${w.lastSeenSecondsAgo}s ago`);
      }
    }
  } catch (clusterErr) {
    console.warn(`  [WARN] Cluster status query: ${clusterErr.message}`);
  }
  console.log('');

  // 4. Check Playwright Chromium Browser Launch
  console.log('--- 4. Playwright Chromium Browser Availability ---');
  try {
    const { chromium } = await import('playwright');
    const startBrowserMs = Date.now();
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const version = browser.version();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.setContent('<html><body><h1>DPDP Worker Health Check</h1></body></html>');
    const title = await page.title();
    await context.close();
    await browser.close();
    const launchMs = Date.now() - startBrowserMs;

    console.log(`  [✓ PASS] Chromium browser launched and tested successfully in ${launchMs}ms.`);
    console.log(`           Browser Version: Chromium v${version}`);
  } catch (browserErr) {
    console.error(`  [✗ FAIL] Chromium launch failed: ${browserErr.message}`);
    console.error(`  [REMEDY] To install Chromium on your local PC, run:`);
    console.error(`           npx playwright install chromium`);
    hasErrors = true;
  }
  console.log('');

  // 4. Overall Readiness Summary
  console.log('================================================================');
  if (hasErrors) {
    console.log(' [STATUS] ✗ WORKER NOT READY: Please resolve the failures above.');
    console.log('================================================================\n');
    process.exit(1);
  } else {
    console.log(' [STATUS] ✓ LOCAL-FIRST WORKER (PRIMARY) IS READY.');
    console.log(' You can start the worker anytime with:');
    console.log('   npm run worker:start');
    console.log(' The local worker will act as PRIMARY and claim new jobs first.');
    console.log(' Railway worker acts as automatic backup if this local PC is offline.');
    console.log('================================================================\n');
    process.exit(0);
  }
}

runHealthCheck().catch((err) => {
  console.error('[Health Check Fatal Error]:', err);
  process.exit(1);
});
