import mongoose from 'mongoose';

const RetestEntrySchema = new mongoose.Schema({
  retestedAt: { type: Date, default: Date.now },
  previousStatus: { type: String, required: true },
  newStatus: { type: String, required: true },
  notes: { type: String, default: '' },
  retestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const FindingSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
      index: true,
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    requirementId: {
      type: String,
      required: true,
      index: true,
      description: 'Versioned requirement ID e.g. DPDP-ACT-SEC-5-NOTICE',
    },
    requirement: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LegalRequirement',
      index: true,
    },
    ruleId: {
      type: String,
      required: true,
      description: 'Display rule reference e.g. Section 5(1)',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
        'Notice & Consent',
        'Data Principal Rights',
        'Data Fiduciary Obligations',
        'Children Data Protection',
        'Third-Party Tracking & Cookies',
        'Grievance Redressal Mechanism',
        'Security Safeguards',
      ],
      default: 'Notice & Consent',
      index: true,
    },
    // Evaluation Status under Section 4
    status: {
      type: String,
      enum: ['pass', 'fail', 'needs_review', 'not_applicable', 'not_tested'],
      default: 'needs_review',
      index: true,
    },
    // Remediation Workflow Status under Section 8
    remediationStatus: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'risk_accepted'],
      default: 'open',
      index: true,
    },
    severity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'informational'],
      default: 'medium',
      index: true,
    },
    // Clear separation of observed facts from AI interpretation
    observedFacts: {
      type: [String],
      default: [],
      description: 'Technical, empirical observations from browser execution and DOM parsing',
    },
    aiInterpretation: {
      type: String,
      default: '',
      description: 'Gemini analytical reasoning separated from empirical facts',
    },
    confidence: {
      type: String,
      enum: ['high', 'medium', 'low', 'uncertain'],
      default: 'high',
    },
    explanation: {
      type: String,
      required: true,
    },
    recommendedRemediation: {
      type: String,
      required: true,
    },
    evidenceReferences: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Evidence',
      },
    ],
    evidence: {
      pageUrl: String,
      screenshotUrl: String,
      selector: String,
      snippet: String,
      detectedAt: { type: Date, default: Date.now },
    },
    // Remediation Tracker Assignment & Notes
    assignedTo: {
      type: String,
      trim: true,
      default: null,
    },
    assignedEmail: {
      type: String,
      trim: true,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    remediationNotes: {
      type: String,
      default: '',
    },
    // Human Review Workflow
    reviewerDecision: {
      type: String,
      enum: ['pending', 'approved', 'amended', 'rejected'],
      default: 'pending',
      index: true,
    },
    reviewerNotes: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    // Retest history
    retestHistory: [RetestEntrySchema],
    resolutionNotes: {
      type: String,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

FindingSchema.index({ assessment: 1, status: 1 });
FindingSchema.index({ organization: 1, remediationStatus: 1 });
FindingSchema.index({ requirementId: 1, status: 1 });

export default mongoose.models.Finding || mongoose.model('Finding', FindingSchema);
