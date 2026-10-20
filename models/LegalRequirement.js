import mongoose from 'mongoose';

const LegalRequirementSchema = new mongoose.Schema(
  {
    requirementId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    officialSource: {
      type: String,
      required: true,
      enum: [
        'Digital Personal Data Protection Act, 2023',
        'Digital Personal Data Protection Rules, 2025',
        'MeitY Official Corrigenda & Commencement Notifications',
      ],
      default: 'Digital Personal Data Protection Act, 2023',
    },
    sectionOrRule: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: String,
      required: true,
      default: '2023.1',
    },
    effectiveDate: {
      type: String,
      default: '2023-08-11',
    },
    isCurrentlyEnforceable: {
      type: Boolean,
      default: true,
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
      required: true,
      index: true,
    },
    applicabilityConditions: {
      type: [String],
      default: [],
      description: 'Website capability keys (e.g. contact_forms, cookies_analytics, user_profiles) triggering applicability',
    },
    expectedControl: {
      type: String,
      required: true,
    },
    assessmentMethod: {
      type: String,
      enum: ['automated_browser', 'document_review', 'hybrid', 'manual_verification'],
      default: 'hybrid',
    },
    requiredEvidence: {
      type: String,
      required: true,
    },
    reviewerGuidance: {
      type: String,
      default: '',
    },
    defaultSeverity: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low', 'informational'],
      default: 'high',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.LegalRequirement ||
  mongoose.model('LegalRequirement', LegalRequirementSchema);
