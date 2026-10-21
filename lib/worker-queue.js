import connectDB from './mongodb.js';
import TestRun from '../models/TestRun.js';
import Assessment from '../models/Assessment.js';
import { executeInspectionRun } from './browser-worker.js';
import { isLocalWorkerActive } from './worker-heartbeat.js';

/**
 * DPDP Vault Worker Queue Management
 * Provides atomic job claiming, concurrency control, stale-job detection, and status reconciliation.
 * Implements Local-First, Railway-Second priority claim strategy.
 */

const STALE_QUEUED_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const STALE_STARTING_THRESHOLD_MS = 60 * 1000; // 60 seconds without browser launch
const STALE_RUNNING_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Atomically claims a specific queued TestRun.
 * @param {string} runId
 * @param {string} workerId
 * @param {object} options
 * @returns {Promise<any>} The claimed TestRun document, or null if already claimed.
 */
export async function claimSpecificJob(runId, workerId = null, options = {}) {
  await connectDB();
  const role = options.role || (process.platform === 'win32' || !process.env.RAILWAY_ENVIRONMENT ? 'local-primary' : 'railway-backup');
  const actualWorkerId = workerId || `worker-${role}-${process.pid}-${Date.now().toString(36)}`;
  const { force = false } = options;

  // Local-First Check for backup workers
  if (role === 'railway-backup' && !force) {
    const localCheck = await isLocalWorkerActive();
    if (localCheck.active) {
      console.log(`[WorkerQueue] Railway backup yielding specific job ${runId}: Primary local worker is active.`);
      return null;
    }
  }

  const startingCutoff = new Date(Date.now() - STALE_STARTING_THRESHOLD_MS);

  const queryFilter = { _id: runId };
  if (!force) {
    queryFilter.$and = [
      {
        $or: [
          { status: { $in: ['queued', 'stale'] } },
          { status: 'starting_browser', updatedAt: { $lt: startingCutoff } },
        ],
      },
      {
        $or: [
          { retryCount: { $exists: false } },
          { retryCount: { $lt: 2 } },
        ],
      },
    ];
  }

  const testRun = await TestRun.findOneAndUpdate(
    queryFilter,
    {
      $set: {
        status: 'starting_browser',
        workerId: actualWorkerId,
        workerRole: role,
        claimedAt: new Date(),
        startTime: new Date(),
        lastHeartbeat: new Date(),
        leaseExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
        currentStep: `Worker assigned (${role}). Launching browser inspection.`,
      },
      $inc: { retryCount: 1 },
    },
    { new: true }
  ).populate('targetId').populate('assessmentId');

  if (testRun && testRun.assessmentId) {
    const assessmentId = testRun.assessmentId._id || testRun.assessmentId;
    await Assessment.findByIdAndUpdate(assessmentId, {
      status: 'in_progress',
      startedAt: testRun.startTime || new Date(),
    });
  }

  return testRun;
}

/**
 * Atomically claims the next available queued TestRun in FIFO order.
 * Follows Local-First priority: Railway backup workers only claim when the local primary worker is offline/unhealthy.
 * @param {string} workerId
 * @param {object} options
 * @returns {Promise<any>}
 */
export async function claimNextQueuedJob(workerId = null, options = {}) {
  await connectDB();
  const role = options.role || (process.platform === 'win32' || !process.env.RAILWAY_ENVIRONMENT ? 'local-primary' : 'railway-backup');
  const actualWorkerId = workerId || `worker-${role}-${process.pid}-${Date.now().toString(36)}`;
  const startingCutoff = new Date(Date.now() - STALE_STARTING_THRESHOLD_MS);

  // If this worker is a backup worker (Railway), check if primary local worker is healthy
  if (role === 'railway-backup') {
    const localWorkerTimeoutMs = parseInt(process.env.LOCAL_WORKER_HEARTBEAT_TIMEOUT_MS, 10) || 20000;
    const localCheck = await isLocalWorkerActive(localWorkerTimeoutMs);

    if (localCheck.active) {
      // Primary local worker is healthy and available: Railway yields all new jobs
      return null;
    }
  }

  const testRun = await TestRun.findOneAndUpdate(
    {
      $and: [
        {
          $or: [
            { status: 'queued' },
            { status: 'stale' },
            { status: 'starting_browser', updatedAt: { $lt: startingCutoff } },
          ],
        },
        {
          $or: [
            { retryCount: { $exists: false } },
            { retryCount: { $lt: 2 } },
          ],
        },
      ],
    },
    {
      $set: {
        status: 'starting_browser',
        workerId: actualWorkerId,
        workerRole: role,
        claimedAt: new Date(),
        startTime: new Date(),
        lastHeartbeat: new Date(),
        leaseExpiresAt: new Date(Date.now() + 2 * 60 * 1000),
        currentStep: `Worker assigned (${role}). Launching browser inspection.`,
      },
      $inc: { retryCount: 1 },
    },
    { sort: { createdAt: 1 }, new: true }
  ).populate('targetId').populate('assessmentId');

  if (testRun && testRun.assessmentId) {
    const assessmentId = testRun.assessmentId._id || testRun.assessmentId;
    await Assessment.findByIdAndUpdate(assessmentId, {
      status: 'in_progress',
      startedAt: testRun.startTime || new Date(),
    });
  }

  return testRun;
}

/**
 * Reconciles stale jobs that have been stuck in 'queued', 'starting_browser', or 'running' states
 * beyond timeout thresholds without active worker updates.
 * @returns {Promise<{ reconciledQueued: number, reconciledStarting: number, reconciledRunning: number }>}
 */
export async function reconcileStaleJobs() {
  await connectDB();
  const now = Date.now();
  const queuedCutoff = new Date(now - STALE_QUEUED_THRESHOLD_MS);
  const startingCutoff = new Date(now - STALE_STARTING_THRESHOLD_MS);
  const runningCutoff = new Date(now - STALE_RUNNING_THRESHOLD_MS);

  // 1. Find stale starting_browser runs (worker crashed / serverless container froze > 60s)
  // Re-queue them so active workers or manual triggers can pick them up (if under retry limit)
  const staleStartingRuns = await TestRun.find({
    status: 'starting_browser',
    $or: [
      { updatedAt: { $lt: startingCutoff } },
      { leaseExpiresAt: { $lt: new Date() } },
    ],
  });

  let reconciledStarting = 0;
  for (const run of staleStartingRuns) {
    const isExceededRetries = (run.retryCount || 0) >= (run.maxRetries || 2);
    // If stuck for > 5 minutes OR exceeded max retries, mark as failed permanently
    if (run.updatedAt < queuedCutoff || isExceededRetries) {
      const errorMsg = isExceededRetries
        ? 'Worker execution aborted: Maximum retry limit reached. Playwright browser failed to initialize or worker terminated unexpectedly.'
        : 'Worker launch timeout: Playwright process did not report browser startup within 5 minutes. The worker may have crashed or was terminated by serverless limits.';
      await TestRun.findByIdAndUpdate(run._id, {
        status: 'failed',
        errorMessage: errorMsg,
        endTime: new Date(),
      });
      if (run.assessmentId) {
        await Assessment.findByIdAndUpdate(run.assessmentId, {
          status: 'failed',
          failureReason: errorMsg,
          completedAt: new Date(),
        });
      }
    } else {
      await TestRun.findByIdAndUpdate(run._id, {
        status: 'queued',
        currentStep: 'Worker connection timed out. Re-queued for active worker pickup.',
        workerId: null,
      });
    }
    reconciledStarting++;
  }

  // 2. Find stale queued runs (never claimed by any worker for > 5 minutes)
  const staleQueuedRuns = await TestRun.find({
    status: 'queued',
    createdAt: { $lt: queuedCutoff },
  });

  let reconciledQueued = 0;
  for (const run of staleQueuedRuns) {
    const errorMsg = 'Assessment queue timeout: No Playwright worker claimed this job within 5 minutes. The persistent worker process may be offline. Please verify worker service or retry.';
    await TestRun.findByIdAndUpdate(run._id, {
      status: 'failed',
      errorMessage: errorMsg,
      endTime: new Date(),
    });

    if (run.assessmentId) {
      await Assessment.findByIdAndUpdate(run.assessmentId, {
        status: 'failed',
        failureReason: errorMsg,
        completedAt: new Date(),
      });
    }
    reconciledQueued++;
  }

  // 3. Find abandoned running runs (worker crashed or died mid-execution > 15 minutes OR lease expired > 3 minutes)
  const staleRunningRuns = await TestRun.find({
    status: { $in: ['running', 'in_progress', 'inspecting_website', 'capturing_evidence'] },
    $or: [
      { updatedAt: { $lt: runningCutoff } },
      { leaseExpiresAt: { $lt: new Date(Date.now() - 3 * 60 * 1000) } },
    ],
  });

  let reconciledRunning = 0;
  for (const run of staleRunningRuns) {
    const isExceededRetries = (run.retryCount || 0) >= (run.maxRetries || 2);
    if (!isExceededRetries) {
      await TestRun.findByIdAndUpdate(run._id, {
        status: 'queued',
        currentStep: 'Worker lease expired or worker crashed. Re-queued for active fallback worker pickup.',
        workerId: null,
        leaseExpiresAt: null,
      });
    } else {
      const errorMsg = 'Worker execution timeout: Browser inspection exceeded maximum duration without progress updates. Inspection terminated.';
      await TestRun.findByIdAndUpdate(run._id, {
        status: 'failed',
        errorMessage: errorMsg,
        leaseExpiresAt: null,
        endTime: new Date(),
      });

      if (run.assessmentId) {
        await Assessment.findByIdAndUpdate(run.assessmentId, {
          status: 'failed',
          failureReason: errorMsg,
          completedAt: new Date(),
        });
      }
    }
    reconciledRunning++;
  }

  return { reconciledQueued, reconciledStarting, reconciledRunning };
}

/**
 * Retrieves high-level queue metrics.
 */
export async function getQueueMetrics() {
  await connectDB();
  const [queued, running, completed, failed] = await Promise.all([
    TestRun.countDocuments({ status: 'queued' }),
    TestRun.countDocuments({ status: { $in: ['starting_browser', 'running', 'in_progress', 'inspecting_website', 'capturing_evidence'] } }),
    TestRun.countDocuments({ status: 'completed' }),
    TestRun.countDocuments({ status: 'failed' }),
  ]);

  return {
    queued,
    running,
    completed,
    failed,
    total: queued + running + completed + failed,
  };
}
