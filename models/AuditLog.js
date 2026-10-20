import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      index: true
    },
    category: {
      type: String,
      enum: [
        'auth',
        'organization',
        'website',
        'assessment',
        'remediation',
        'compliance',
        'system',
        'security',
        'target_approval',
        'document_upload',
        'profile_config'
      ],
      default: 'system',
      index: true
    },
    actor: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      email: { type: String, trim: true },
      ipAddress: { type: String, trim: true },
      userAgent: { type: String, trim: true }
    },
    target: {
      entityType: { type: String, trim: true },
      entityId: { type: mongoose.Schema.Types.ObjectId },
      identifier: { type: String, trim: true }
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      enum: ['success', 'failure', 'warning'],
      default: 'success'
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false }
  }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ 'actor.userId': 1, createdAt: -1 });

const AuditLog =
  mongoose.models.AuditLog ||
  mongoose.model('AuditLog', AuditLogSchema);

export default AuditLog;
