import mongoose from 'mongoose';

const EvidenceSchema = new mongoose.Schema(
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
    scenarioId: {
      type: String,
      required: true,
      index: true,
    },
    evidenceType: {
      type: String,
      enum: [
        'screenshot',
        'visible_text',
        'dom_snippet',
        'cookie_list',
        'form_fields',
        'network_call',
        'console_log',
      ],
      required: true,
      index: true,
    },
    pageUrl: {
      type: String,
      required: true,
    },
    pageTitle: {
      type: String,
      default: '',
    },
    screenshotPath: {
      type: String,
      default: null,
    },
    extractedContent: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    redactionStatus: {
      type: String,
      enum: ['none', 'redacted', 'not_applicable'],
      default: 'none',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.Evidence || mongoose.model('Evidence', EvidenceSchema);
