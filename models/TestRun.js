import mongoose from 'mongoose';

const LogEntrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  level: { type: String, enum: ['info', 'warn', 'error', 'debug'], default: 'info' },
  message: { type: String, required: true },
});

const TestRunSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
      index: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovedTarget',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        'queued',
        'starting_browser',
        'running',
        'in_progress',
        'inspecting_website',
        'capturing_evidence',
        'awaiting_user_input',
        'completed',
        'failed',
        'cancelled',
      ],
      default: 'queued',
      index: true,
    },
    workerId: {
      type: String,
      default: null,
    },
    claimedAt: {
      type: Date,
      default: null,
    },
    runOptions: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    currentStep: {
      type: String,
      default: 'Initializing test execution',
    },
    pagesVisited: [
      {
        url: { type: String, required: true },
        title: { type: String, default: '' },
        visitedAt: { type: Date, default: Date.now },
        statusCode: { type: Number, default: 200 },
      },
    ],
    evidenceCount: {
      type: Number,
      default: 0,
    },
    latestScreenshot: {
      type: String,
      default: null,
    },
    latestScreenshotUrl: {
      type: String,
      default: null,
    },
    latestScreenshotTime: {
      type: Date,
      default: null,
    },
    currentUrl: {
      type: String,
      default: null,
    },
    currentAction: {
      type: String,
      default: null,
    },
    startTime: {
      type: Date,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    // Safe assistance for CAPTCHA / OTP
    userAssistanceRequired: {
      type: Boolean,
      default: false,
    },
    userAssistancePrompt: {
      type: String,
      default: null,
    },
    userAssistanceData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    authTestingResult: {
      status: {
        type: String,
        enum: [
          'pending',
          'running',
          'passed',
          'failed',
          'needs_assistance',
          'performed',
          'skipped',
          'blocked',
          'not_applicable',
        ],
        default: 'not_applicable',
      },
      authMethod: { type: String, default: null },
      loginUrl: { type: String, default: null },
      usernameMasked: { type: String, default: null },
      sessionEstablished: { type: Boolean, default: false },
      details: { type: String, default: null },
    },
    logs: [LogEntrySchema],
    maxPages: {
      type: Number,
      default: 15,
    },
    maxActions: {
      type: Number,
      default: 50,
    },
    timeoutSeconds: {
      type: Number,
      default: 120,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.TestRun || mongoose.model('TestRun', TestRunSchema);
