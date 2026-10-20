import mongoose from 'mongoose';

const WebsiteFeatureSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      enum: [
        'public_info',
        'registration_login',
        'contact_forms',
        'booking_forms',
        'payments',
        'user_profiles',
        'file_uploads',
        'newsletter_marketing',
        'cookies_analytics',
        'third_party_integrations',
        'account_deletion_data_request',
        'other'
      ]
    },
    label: {
      type: String,
      required: true
    },
    enabled: {
      type: Boolean,
      default: false
    },
    notes: {
      type: String
    }
  },
  { _id: false }
);

const AssessmentProfileSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    approvedTarget: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovedTarget',
      required: true,
      index: true
    },
    websiteUrl: {
      type: String,
      required: true,
      trim: true
    },
    websitePurpose: {
      type: String,
      trim: true
    },
    websiteFeatures: [WebsiteFeatureSchema],
    otherFeaturesDescription: {
      type: String,
      trim: true
    },
    assessmentMode: {
      type: String,
      enum: [
        'website_only',
        'website_with_documents',
        'authorized_login_testing',
        'manual_evidence_review',
        'combined_assessment'
      ],
      default: 'website_with_documents'
    },
    loginWorkflowDetails: {
      hasAuthTesting: { type: Boolean, default: false },
      authMethod: {
        type: String,
        enum: ['password', 'sso_mfa_other', 'public_only'],
        default: 'public_only'
      },
      loginUrl: { type: String, trim: true },
      testUsername: { type: String, select: false },
      encryptedPassword: { type: String, select: false },
      skipAuthenticatedTesting: { type: Boolean, default: true },
      authorizedConfirmation: { type: Boolean, default: false },
      instructions: { type: String }
    },
    scopeSummary: {
      type: String
    },
    status: {
      type: String,
      enum: ['draft', 'ready_for_assessment', 'archived'],
      default: 'ready_for_assessment',
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

AssessmentProfileSchema.index({ organization: 1, createdAt: -1 });

const AssessmentProfile =
  mongoose.models.AssessmentProfile ||
  mongoose.model('AssessmentProfile', AssessmentProfileSchema);

export default AssessmentProfile;
