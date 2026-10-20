import connectDB from './mongodb.js';
import TestRun from '../models/TestRun.js';
import Assessment from '../models/Assessment.js';
import { executeInspectionRun } from './browser-worker.js';

/**
 * DPDP Vault Worker Queue Management
 * Provides atomic job claiming, concurrency control, stale-job detection, and status reconciliation.
 */

const STALE_QUEUED_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const STALE_RUNNING_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Atomically claims a specific queued TestRun.
 * @param {string} runId
 * @param {string} workerId
 * @returns {Promise<any>} The claimed TestRun document, or null if already claimed.
 */
export async function claimSpecificJob(runId, workerId = null) {
  await connectDB();
  const actualWorkerId = workerId || `worker-${process.pid}-${Date.now()}`;

  const testRun = await TestRun.findOneAndUpdate(
    {
      _id: runId,
      status: { $in: ['queued', 'stale'] },
    },
    {
      $set: {
        status: 'starting_browser',
        workerId: actualWorkerId,
        claimedAt: new Date(),
        startTime: new Date(),
        currentStep: 'Worker assigned. Launching browser inspection.',
      },
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
 * @param {string} workerId
 * @returns {Promise<any>}
 */
export async function claimNextQueuedJob(workerId = null) {
  await connectDB();
  const actualWorkerId = workerId || `worker-${process.pid}-${Date.now()}`;

  const testRun = await TestRun.findOneAndUpdate(
    {
      status: 'queued',
    },
    {
      $set: {
        status: 'starting_browser',
        workerId: actualWorkerId,
        claimedAt: new Date(),
        startTime: new Date(),
        currentStep: 'Worker assigned. Launching browser inspection.',
      },
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
 * Reconciles stale jobs that have been stuck in 'queued' or 'running' states
 * beyond timeout thresholds without active worker updates.
 * @returns {Promise<{ reconciledQueued: number, reconciledRunning: number }>}
 */
export async function reconcileStaleJobs() {
  await connectDB();
  const now = Date.now();
  const queuedCutoff = new Date(now - STALE_QUEUED_THRESHOLD_MS);
  const runningCutoff = new Date(now - STALE_RUNNING_THRESHOLD_MS);

  // 1. Find stale queued runs (never claimed by any worker for > 5 minutes)
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

  // 2. Find abandoned running runs (worker crashed or died mid-execution > 15 minutes without progress)
  const staleRunningRuns = await TestRun.find({
    status: { $in: ['starting_browser', 'running', 'in_progress', 'inspecting_website'] },
    updatedAt: { $lt: runningCutoff },
  });

  let reconciledRunning = 0;
  for (const run of staleRunningRuns) {
    const errorMsg = 'Worker execution timeout: Browser inspection exceeded maximum duration without progress updates. Inspection terminated.';
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
    reconciledRunning++;
  }

  return { reconciledQueued, reconciledRunning };
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
