import mongoose from 'mongoose';

const ApprovedTargetSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true
    },
    approvedDomain: {
      type: String,
      required: [true, 'Approved domain is required (e.g. example.com)'],
      trim: true,
      lowercase: true,
      index: true
    },
    targetUrl: {
      type: String,
      required: [true, 'Base target URL is required'],
      trim: true
    },
    approvedScope: {
      type: [String],
      default: [
        'public_pages',
        'cookie_consent_banners',
        'tracking_scripts',
        'privacy_policy',
        'grievance_contact_verification'
      ]
    },
    excludedPaths: {
      type: [String],
      default: ['/admin', '/internal', '/api/private']
    },
    authorizationConfirmation: {
      confirmed: {
        type: Boolean,
        required: [true, 'Explicit authorization confirmation is required'],
        default: false
      },
      confirmedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      confirmedByName: {
        type: String,
        trim: true
      },
      confirmedByDesignation: {
        type: String,
        trim: true
      },
      affirmationText: {
        type: String,
        default: 'I confirm and warrant that our organization is the legal owner or authorized representative of this domain, and explicitly authorizes automated privacy crawling, DOM analysis, and compliance inspection under the DPDP Act 2023.'
      },
      confirmedAt: {
        type: Date,
        default: Date.now
      }
    },
    approvalTimestamp: {
      type: Date,
      default: Date.now
    },
    targetStatus: {
      type: String,
      enum: ['approved', 'pending_verification', 'revoked', 'expired'],
      default: 'approved',
      index: true
    },
    ssrfValidated: {
      type: Boolean,
      default: true
    },
    ssrfValidatedAt: {
      type: Date,
      default: Date.now
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    isDemoSite: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

ApprovedTargetSchema.index({ organization: 1, approvedDomain: 1 }, { unique: true });

const ApprovedTarget =
  mongoose.models.ApprovedTarget ||
  mongoose.model('ApprovedTarget', ApprovedTargetSchema);

export default ApprovedTarget;
