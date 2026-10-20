import { EventEmitter } from 'events';
import connectDB from './mongodb.js';
import AssessmentEvent from '../models/AssessmentEvent.js';
import TestRun from '../models/TestRun.js';

// Global singleton EventEmitter across Next.js module evaluations
if (!global._dpdpEventBus) {
  global._dpdpEventBus = new EventEmitter();
  global._dpdpEventBus.setMaxListeners(200);
}

const eventBus = global._dpdpEventBus;

/**
 * Emits an assessment event, persists it to MongoDB, updates the TestRun snapshot,
 * and notifies active SSE streams.
 */
export async function emitAssessmentEvent({
  assessmentId,
  testRunId,
  eventType,
  title,
  description = '',
  url = null,
  screenshotPath = null,
  stepName = null,
  progress = null,
  data = {},
}) {
  const timestamp = new Date();

  const eventPayload = {
    assessmentId: String(assessmentId),
    testRunId: String(testRunId),
    eventType,
    title,
    description,
    url,
    screenshotPath,
    stepName,
    progress,
    data,
    timestamp,
  };

  // 1. Asynchronously persist to MongoDB
  try {
    await connectDB();
    await AssessmentEvent.create(eventPayload);

    // Update TestRun live preview snapshot if progress, step, url, or screenshot is present
    const testRunUpdates = {};
    if (progress !== null && progress !== undefined) testRunUpdates.progress = progress;
    if (stepName) testRunUpdates.currentStep = stepName;
    if (url) testRunUpdates.currentUrl = url;
    if (screenshotPath) {
      testRunUpdates.latestScreenshot = screenshotPath;
      testRunUpdates.latestScreenshotUrl = url;
      testRunUpdates.latestScreenshotTime = timestamp;
    }
    if (eventType === 'completed') testRunUpdates.status = 'completed';
    if (eventType === 'failed') testRunUpdates.status = 'failed';
    if (eventType === 'cancelled') testRunUpdates.status = 'cancelled';
    if (eventType === 'human_intervention') {
      testRunUpdates.status = 'awaiting_user_input';
      testRunUpdates.userAssistanceRequired = true;
    }

    if (Object.keys(testRunUpdates).length > 0) {
      await TestRun.findByIdAndUpdate(testRunId, testRunUpdates);
    }
  } catch (err) {
    console.error('[EventBus] Failed to persist AssessmentEvent to MongoDB:', err.message);
  }

  // 2. Broadcast via EventEmitter to real-time subscribers
  eventBus.emit(`assessment:${String(assessmentId)}`, eventPayload);
  eventBus.emit(`testrun:${String(testRunId)}`, eventPayload);

  return eventPayload;
}

/**
 * Subscribes a callback to real-time events for an assessment.
 * Returns an unsubscribe function.
 */
export function subscribeToAssessment(assessmentId, listener) {
  const channel = `assessment:${String(assessmentId)}`;
  eventBus.on(channel, listener);
  return () => {
    eventBus.off(channel, listener);
  };
}

/**
 * Fetches all persisted events for an assessment or test run in chronological order.
 */
export async function getAssessmentEvents(assessmentId, limit = 100) {
  await connectDB();
  return AssessmentEvent.find({ assessmentId })
    .sort({ timestamp: 1 })
    .limit(limit)
    .lean();
}

export default eventBus;
