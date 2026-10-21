import fs from 'fs';
import path from 'path';

// Auto-load env
try {
  const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.worker'), 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  });
} catch (e) {}

import connectDB from '../lib/mongodb.js';
import Organization from '../models/Organization.js';
import ApprovedTarget from '../models/ApprovedTarget.js';
import Assessment from '../models/Assessment.js';
import TestRun from '../models/TestRun.js';
import WorkerHeartbeat from '../models/WorkerHeartbeat.js';
import { claimNextQueuedJob, reconcileStaleJobs } from '../lib/worker-queue.js';
import { recordHeartbeat, setWorkerOffline, isLocalWorkerActive } from '../lib/worker-heartbeat.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log(' TESTING LOCAL-FIRST WORKER & RAILWAY FAILOVER STRATEGY');
  console.log('================================================================\n');

  await connectDB();

  let org = await Organization.findOne();
  if (!org) {
    org = await Organization.create({ name: 'Failover Test Org', industry: 'Testing' });
  }

  let target = await ApprovedTarget.findOne();
  if (!target) {
    target = await ApprovedTarget.create({
      organization: org._id,
      targetUrl: 'https://www.example.com',
      approvedDomain: 'www.example.com',
      validationStatus: 'approved',
    });
  }

  const assessment = await Assessment.create({
    organization: org._id,
    targetUrl: 'https://www.example.com',
    approvedTarget: target._id,
    status: 'queued',
  });

  // ------------------------------------------------------------------------
  // TEST 1: Both Workers Running -> Local Worker Gets Priority
  // ------------------------------------------------------------------------
  console.log('--- Test 1: Priority Claiming (Local Primary vs Railway Backup) ---');

  // Register Local Worker Heartbeat as online
  const localWorkerId = `test-local-primary-${Date.now()}`;
  const railwayWorkerId = `test-railway-backup-${Date.now()}`;

  await recordHeartbeat({
    workerId: localWorkerId,
    role: 'local-primary',
    status: 'online',
  });

  await recordHeartbeat({
    workerId: railwayWorkerId,
    role: 'railway-backup',
    status: 'online',
  });

  const runA = await TestRun.create({
    assessmentId: assessment._id,
    targetId: target._id,
    status: 'queued',
    retryCount: 0,
    maxRetries: 2,
  });

  // Railway attempts to claim first
  const railwayAttempt = await claimNextQueuedJob(railwayWorkerId, { role: 'railway-backup' });
  assert(railwayAttempt === null, 'Railway backup yielded queued job because local primary is healthy');

  // Local Worker attempts to claim
  const localClaim = await claimNextQueuedJob(localWorkerId, { role: 'local-primary' });
  assert(localClaim && String(localClaim._id) === String(runA._id), 'Local primary successfully claimed queued job');
  assert(localClaim?.workerRole === 'local-primary', 'Claimed job tagged with workerRole: local-primary');
  console.log('');

  // ------------------------------------------------------------------------
  // TEST 2: Local Worker Stopped/Expired -> Railway Automatically Takes Over
  // ------------------------------------------------------------------------
  console.log('--- Test 2: Automatic Failover when Local Worker is Offline ---');

  // Mark local worker as offline
  await setWorkerOffline(localWorkerId, 'local-primary');

  // Also ensure no other local worker has a fresh heartbeat
  await WorkerHeartbeat.updateMany(
    { role: 'local-primary' },
    { $set: { status: 'offline', lastHeartbeat: new Date(Date.now() - 30000) } }
  );

  const localHealthCheck = await isLocalWorkerActive(20000);
  assert(!localHealthCheck.active, 'Local primary confirmed offline/unhealthy');

  const runB = await TestRun.create({
    assessmentId: assessment._id,
    targetId: target._id,
    status: 'queued',
    retryCount: 0,
    maxRetries: 2,
  });

  // Railway attempts to claim now that local is offline
  const railwayClaim = await claimNextQueuedJob(railwayWorkerId, { role: 'railway-backup' });
  assert(railwayClaim && String(railwayClaim._id) === String(runB._id), 'Railway backup successfully claimed job after local worker went offline');
  assert(railwayClaim?.workerRole === 'railway-backup', 'Claimed job tagged with workerRole: railway-backup');
  console.log('');

  // ------------------------------------------------------------------------
  // TEST 3: Simultaneous Claim Race Protection (Atomic Operation)
  // ------------------------------------------------------------------------
  console.log('--- Test 3: Concurrency Protection (Atomic Collision Prevention) ---');

  const runC = await TestRun.create({
    assessmentId: assessment._id,
    targetId: target._id,
    status: 'queued',
    retryCount: 0,
    maxRetries: 2,
  });

  // Both workers attempt atomic claim simultaneously
  const [attempt1, attempt2] = await Promise.all([
    claimNextQueuedJob('worker-concurrent-A', { role: 'local-primary' }),
    claimNextQueuedJob('worker-concurrent-B', { role: 'local-primary' }),
  ]);

  const claimedCount = (attempt1 ? 1 : 0) + (attempt2 ? 1 : 0);
  assert(claimedCount === 1, `Exactly one worker won the race condition (winners: ${claimedCount})`);
  console.log('');

  // ------------------------------------------------------------------------
  // TEST 4: Crash Recovery via Lease Expiration
  // ------------------------------------------------------------------------
  console.log('--- Test 4: Crash Recovery after Lease Expiry ---');

  // Simulate local worker crashed mid-run: lease expired 10 minutes ago
  const runD = await TestRun.create({
    assessmentId: assessment._id,
    targetId: target._id,
    status: 'inspecting_website',
    workerId: 'crashed-worker-local',
    workerRole: 'local-primary',
    leaseExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // Expired lease
    updatedAt: new Date(Date.now() - 5 * 60 * 1000),
    retryCount: 0,
    maxRetries: 2,
  });

  const reconcileRes = await reconcileStaleJobs();
  const refreshedRunD = await TestRun.findById(runD._id);
  assert(refreshedRunD.status === 'queued', 'Crashed run with expired lease safely recovered to queued status');
  assert(refreshedRunD.workerId === null, 'Crashed workerId cleared upon recovery');
  // Complete runD so it doesn't linger in queue during Test 5
  await TestRun.findByIdAndUpdate(runD._id, { status: 'completed' });
  console.log('');

  // ------------------------------------------------------------------------
  // TEST 5: Local Worker Recovers While Railway Is Active
  // ------------------------------------------------------------------------
  console.log('--- Test 5: Local Recovery While Railway is Processing ---');

  // Active Railway job (valid lease)
  const runE = await TestRun.create({
    assessmentId: assessment._id,
    targetId: target._id,
    status: 'inspecting_website',
    workerId: railwayWorkerId,
    workerRole: 'railway-backup',
    leaseExpiresAt: new Date(Date.now() + 2 * 60 * 1000), // Active valid lease
    updatedAt: new Date(),
    retryCount: 1,
    maxRetries: 2,
  });

  // New incoming job
  const runF = await TestRun.create({
    assessmentId: assessment._id,
    targetId: target._id,
    status: 'queued',
    retryCount: 0,
    maxRetries: 2,
  });

  // Local worker comes back online
  await recordHeartbeat({
    workerId: localWorkerId,
    role: 'local-primary',
    status: 'online',
  });

  // Local worker claims
  const localClaimRecovered = await claimNextQueuedJob(localWorkerId, { role: 'local-primary' });
  assert(localClaimRecovered && String(localClaimRecovered._id) === String(runF._id), 'Recovered local worker claimed new job runF');

  // Verify Railway's active runE was NOT touched
  const untouchedRunE = await TestRun.findById(runE._id);
  assert(untouchedRunE.status === 'inspecting_website', 'Railway active job runE was NOT interrupted or stolen');
  assert(untouchedRunE.workerId === railwayWorkerId, 'Railway workerId preserved on active job');
  console.log('');

  // ------------------------------------------------------------------------
  // TEST 6: Retry Limit Cap (Circuit Breaker)
  // ------------------------------------------------------------------------
  console.log('--- Test 6: Bounded Retries & Terminal Failure Guard ---');

  const runG = await TestRun.create({
    assessmentId: assessment._id,
    targetId: target._id,
    status: 'starting_browser',
    retryCount: 2, // Reached maxRetries
    maxRetries: 2,
    leaseExpiresAt: new Date(Date.now() - 5 * 60 * 1000),
  });

  // Explicitly bypass Mongoose timestamps to simulate stale timestamp
  await TestRun.updateOne(
    { _id: runG._id },
    { $set: { updatedAt: new Date(Date.now() - 5 * 60 * 1000) } },
    { timestamps: false }
  );

  await reconcileStaleJobs();
  const refreshedRunG = await TestRun.findById(runG._id);
  assert(refreshedRunG.status === 'failed', 'Max-retried job permanently marked failed; no infinite re-queuing');
  console.log('');

  // Cleanup test documents
  await TestRun.deleteMany({ _id: { $in: [runA._id, runB._id, runC._id, runD._id, runE._id, runF._id, runG._id] } });
  await Assessment.findByIdAndDelete(assessment._id);
  await WorkerHeartbeat.deleteMany({ workerId: { $in: [localWorkerId, railwayWorkerId, 'worker-concurrent-A', 'worker-concurrent-B'] } });

  console.log('================================================================');
  console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed === 0) {
    console.log('[ALL SCENARIOS VERIFIED SUCCESSFULLY]');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test execution error:', e);
  process.exit(1);
});
