import mongoose from 'mongoose';

const BrowserActionSchema = new mongoose.Schema(
  {
    testRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestRun',
      required: true,
      index: true,
    },
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      enum: [
        'navigate',
        'click',
        'input',
        'extract_text',
        'screenshot',
        'scroll',
        'detect_form',
        'check_cookie_banner',
        'user_intervention',
        'blocked_navigation',
      ],
      required: true,
      index: true,
    },
    targetSelector: {
      type: String,
      default: null,
    },
    url: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'blocked', 'skipped'],
      default: 'success',
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.BrowserAction || mongoose.model('BrowserAction', BrowserActionSchema);
