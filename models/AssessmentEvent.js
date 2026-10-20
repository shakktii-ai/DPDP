import mongoose from 'mongoose';

const AssessmentEventSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
      index: true,
    },
    testRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestRun',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'queued',
        'browser_started',
        'navigation',
        'page_inspected',
        'consent_detected',
        'step_started',
        'step_completed',
        'screenshot_captured',
        'scenario_evaluated',
        'finding_recorded',
        'auth_attempt',
        'human_intervention',
        'completed',
        'failed',
        'cancelled',
      ],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    url: {
      type: String,
      default: null,
    },
    screenshotPath: {
      type: String,
      default: null,
    },
    stepName: {
      type: String,
      default: null,
    },
    progress: {
      type: Number,
      default: 0,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

AssessmentEventSchema.index({ assessmentId: 1, timestamp: 1 });
AssessmentEventSchema.index({ testRunId: 1, timestamp: 1 });

export default mongoose.models.AssessmentEvent ||
  mongoose.model('AssessmentEvent', AssessmentEventSchema);
