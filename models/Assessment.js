import mongoose from 'mongoose';

const AssessmentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    targetUrl: {
      type: String,
      required: [true, 'Target website URL is required'],
      trim: true
    },
    websiteName: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['queued', 'in_progress', 'completed', 'failed', 'cancelled'],
      default: 'queued',
      index: true
    },
    modelUsed: {
      type: String,
      default: 'gemini-3.8-flash'
    },
    testMode: {
      type: String,
      enum: ['automated_vision', 'dom_inspect', 'hybrid'],
      default: 'hybrid'
    },
    complianceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    findingsCount: {
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    triggeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    scopeSummary: {
      type: String
    },
    previousAssessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      default: null,
      index: true
    },
    rootAssessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      default: null,
      index: true
    },
    sequenceNumber: {
      type: Number,
      default: 1
    },
    isReassessment: {
      type: Boolean,
      default: false,
      index: true
    },
    scopeConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    failureReason: {
      type: String,
      trim: true
    },
    notes: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

AssessmentSchema.index({ organization: 1, status: 1 });
AssessmentSchema.index({ createdAt: -1 });

const Assessment =
  mongoose.models.Assessment ||
  mongoose.model('Assessment', AssessmentSchema);

export default Assessment;
