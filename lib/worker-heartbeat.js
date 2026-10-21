import os from 'os';
import connectDB from './mongodb.js';
import WorkerHeartbeat from '../models/WorkerHeartbeat.js';
import { redactSensitiveData } from './evidence-redactor.js';

export const DEFAULT_LOCAL_TIMEOUT_MS = parseInt(process.env.LOCAL_WORKER_HEARTBEAT_TIMEOUT_MS, 10) || 20000;
export const DEFAULT_HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS, 10) || 5000;

/**
 * Records or updates the heartbeat of a worker process.
 */
export async function recordHeartbeat(params) {
  await connectDB();
  const {
    workerId,
    role,
    status = 'online',
    activeRunId = null,
    currentStep = null,
    lastError = null,
    metrics = {},
  } = params;

  const updateDoc = {
    $set: {
      role,
      status,
      lastHeartbeat: new Date(),
      activeRunId: activeRunId || null,
      currentStep: currentStep || null,
      hostname: os.hostname(),
      platform: process.platform,
    },
  };

  if (lastError) {
    updateDoc.$set.lastError = redactSensitiveData(String(lastError));
  } else if (lastError === null) {
    updateDoc.$set.lastError = null;
  }

  if (metrics.jobsCompleted !== undefined) {
    updateDoc.$set['metrics.jobsCompleted'] = metrics.jobsCompleted;
  }
  if (metrics.jobsFailed !== undefined) {
    updateDoc.$set['metrics.jobsFailed'] = metrics.jobsFailed;
  }
  if (metrics.uptimeSeconds !== undefined) {
    updateDoc.$set['metrics.uptimeSeconds'] = metrics.uptimeSeconds;
  }

  return WorkerHeartbeat.findOneAndUpdate(
    { workerId },
    updateDoc,
    { upsert: true, new: true }
  );
}

/**
 * Determines whether any primary local worker is actively healthy and reporting heartbeats.
 * @param {number} timeoutMs - Threshold in ms for determining if heartbeat is fresh.
 * @returns {Promise<{ active: boolean, worker: any, lastSeenMs: number }>}
 */
export async function isLocalWorkerActive(timeoutMs = DEFAULT_LOCAL_TIMEOUT_MS) {
  await connectDB();
  const cutoff = new Date(Date.now() - timeoutMs);

  const localWorker = await WorkerHeartbeat.findOne({
    role: 'local-primary',
    status: { $in: ['online', 'busy', 'idle'] },
    lastHeartbeat: { $gte: cutoff },
  }).sort({ lastHeartbeat: -1 });

  if (localWorker) {
    const lastSeenMs = Date.now() - new Date(localWorker.lastHeartbeat).getTime();
    return {
      active: true,
      worker: localWorker,
      lastSeenMs,
    };
  }

  return {
    active: false,
    worker: null,
    lastSeenMs: Infinity,
  };
}

/**
 * Marks a worker as offline on graceful shutdown.
 */
export async function setWorkerOffline(workerId, role = 'local-primary') {
  try {
    await connectDB();
    await WorkerHeartbeat.findOneAndUpdate(
      { workerId },
      {
        $set: {
          role,
          status: 'offline',
          activeRunId: null,
          currentStep: 'Worker stopped gracefully.',
          lastHeartbeat: new Date(),
        },
      }
    );
  } catch (err) {
    // Non-fatal
  }
}

/**
 * Returns cluster-wide worker health overview.
 */
export async function getClusterWorkerStatuses(timeoutMs = DEFAULT_LOCAL_TIMEOUT_MS) {
  await connectDB();
  const cutoff = new Date(Date.now() - timeoutMs);

  const allWorkers = await WorkerHeartbeat.find().sort({ lastHeartbeat: -1 }).lean();

  const primaryWorkers = [];
  const backupWorkers = [];

  for (const w of allWorkers) {
    const isRecent = new Date(w.lastHeartbeat) >= cutoff;
    const isOnline = isRecent && w.status !== 'offline';
    const formatted = {
      ...w,
      isHealthy: isOnline,
      lastSeenSecondsAgo: Math.round((Date.now() - new Date(w.lastHeartbeat).getTime()) / 1000),
    };

    if (w.role === 'local-primary') {
      primaryWorkers.push(formatted);
    } else {
      backupWorkers.push(formatted);
    }
  }

  const localPrimaryActive = primaryWorkers.some((w) => w.isHealthy);
  const railwayBackupActive = backupWorkers.some((w) => w.isHealthy);

  return {
    localPrimaryActive,
    railwayBackupActive,
    primaryWorkers,
    backupWorkers,
    allWorkers,
  };
}
