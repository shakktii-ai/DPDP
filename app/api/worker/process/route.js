import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { claimSpecificJob, claimNextQueuedJob, getQueueMetrics, reconcileStaleJobs } from '@/lib/worker-queue';
import { executeInspectionRun } from '@/lib/browser-worker';
import TestRun from '@/models/TestRun';

export const dynamic = 'force-dynamic';

/**
 * GET /api/worker/process
 * Inspects queue health and active workers. Automatically reconciles stale jobs.
 */
export async function GET(request) {
  try {
    await connectDB();
    const staleResult = await reconcileStaleJobs();
    const metrics = await getQueueMetrics();

    return NextResponse.json({
      success: true,
      workerStatus: 'online',
      metrics,
      reconciled: staleResult,
    });
  } catch (err) {
    console.error('Error fetching worker status:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/worker/process
 * Claims and executes a queued inspection run.
 * Can be called with a specific runId or will claim the next FIFO queued run.
 */
export async function POST(request) {
  try {
    await connectDB();

    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      // Body may be empty if caller wants next FIFO job
    }

    const { runId, options = {}, synchronous = false, force = false } = body;

    let claimedRun = null;
    if (runId) {
      claimedRun = await claimSpecificJob(runId, null, { force });
    } else {
      claimedRun = await claimNextQueuedJob();
    }

    if (!claimedRun) {
      // Check if the specific run already exists in a non-claimable state
      if (runId) {
        const existing = await TestRun.findById(runId);
        if (existing) {
          // If already completed, return existing
          if (existing.status === 'completed') {
            return NextResponse.json({
              success: true,
              message: `TestRun is already completed.`,
              testRun: existing,
            });
          }
          // If stuck in starting_browser or running, force claim if requested
          if (force) {
            claimedRun = await claimSpecificJob(runId, null, { force: true });
          }
        }
      }
      if (!claimedRun) {
        return NextResponse.json({
          success: false,
          message: 'No eligible queued runs found to claim.',
        }, { status: 404 });
      }
    }

    // Merge options with any saved runOptions on the TestRun
    const mergedOptions = {
      ...(claimedRun.runOptions || {}),
      ...options,
    };

    if (synchronous) {
      // Run synchronously for testing scripts or external worker runners
      await executeInspectionRun(claimedRun._id, mergedOptions);
      const finishedRun = await TestRun.findById(claimedRun._id);
      return NextResponse.json({
        success: true,
        message: 'Worker execution completed.',
        testRun: finishedRun,
      });
    } else {
      // Asynchronously trigger execution
      executeInspectionRun(claimedRun._id, mergedOptions).catch((err) => {
        console.error(`[WorkerProcess Error for ${claimedRun._id}]:`, err);
      });

      return NextResponse.json({
        success: true,
        message: 'Worker claimed job successfully and browser execution has started.',
        testRun: claimedRun,
      }, { status: 202 });
    }
  } catch (err) {
    console.error('Error processing worker queue job:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
