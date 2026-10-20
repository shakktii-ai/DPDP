import mongoose from 'mongoose';

const ScenarioResultSchema = new mongoose.Schema(
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
    title: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
        'notice_and_consent',
        'grievance_redressal',
        'data_minimization',
        'user_rights',
        'security_safeguards',
        'third_party_tracking',
      ],
      default: 'notice_and_consent',
    },
    status: {
      type: String,
      enum: [
        'passed',
        'needs_review',
        'failed',
        'inconclusive',
        'skipped',
        'not_applicable',
        'action_needed',
        'compliant',
      ],
      default: 'needs_review',
      index: true,
    },
    summary: {
      type: String,
      required: true,
    },
    dpdpReference: {
      type: String,
      default: '',
    },
    evidenceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Evidence',
      },
    ],
    observedFindings: [
      {
        type: String,
      },
    ],
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.ScenarioResult || mongoose.model('ScenarioResult', ScenarioResultSchema);
