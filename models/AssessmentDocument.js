import mongoose from 'mongoose';

const AssessmentDocumentSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    documentType: {
      type: String,
      enum: [
        'privacy_policy',
        'terms_of_service',
        'consent_notice',
        'data_retention_policy',
        'grievance_policy',
        'other'
      ],
      required: true,
      index: true
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true
    },
    sourceType: {
      type: String,
      enum: ['url', 'upload'],
      required: true
    },
    url: {
      type: String,
      trim: true
    },
    fileName: {
      type: String,
      trim: true
    },
    mimeType: {
      type: String
    },
    sizeBytes: {
      type: Number
    },
    extractedText: {
      type: String,
      select: true
    },
    textLength: {
      type: Number,
      default: 0
    },
    retentionUntil: {
      type: Date,
      default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Default 1 year statutory retention
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active'
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

AssessmentDocumentSchema.index({ organization: 1, documentType: 1 });

const AssessmentDocument =
  mongoose.models.AssessmentDocument ||
  mongoose.model('AssessmentDocument', AssessmentDocumentSchema);

export default AssessmentDocument;
