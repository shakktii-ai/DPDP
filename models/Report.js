import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema(
  {
    reportNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
      index: true
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    targetUrl: {
      type: String,
      required: true
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true
    },
    complianceGrade: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'F'],
      default: 'C'
    },
    executiveSummary: {
      type: String
    },
    findingsCount: {
      critical: { type: Number, default: 0 },
      high: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      low: { type: Number, default: 0 },
      total: { type: Number, default: 0 }
    },
    downloadUrl: {
      type: String
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

ReportSchema.index({ organization: 1, createdAt: -1 });

const Report =
  mongoose.models.Report ||
  mongoose.model('Report', ReportSchema);

export default Report;
