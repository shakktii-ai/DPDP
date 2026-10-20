import mongoose from 'mongoose';

const StructuredObservationSchema = new mongoose.Schema(
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
    pageUrl: {
      type: String,
      required: true,
    },
    screenshotReference: {
      type: String,
      default: null,
    },
    observedUiElement: {
      type: String,
      default: null,
    },
    actionTaken: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    result: {
      type: String,
      required: true,
    },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low', 'uncertain'],
      default: 'high',
    },
    redactionStatus: {
      type: String,
      enum: ['redacted', 'none', 'not_applicable'],
      default: 'redacted',
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

export default mongoose.models.StructuredObservation ||
  mongoose.model('StructuredObservation', StructuredObservationSchema);
