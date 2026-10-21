import mongoose from 'mongoose';

const WorkerHeartbeatSchema = new mongoose.Schema(
  {
    workerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['local-primary', 'railway-backup'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['online', 'busy', 'idle', 'shutting_down', 'offline'],
      default: 'online',
      index: true,
    },
    hostname: {
      type: String,
      default: '',
    },
    platform: {
      type: String,
      default: '',
    },
    lastHeartbeat: {
      type: Date,
      default: Date.now,
      index: true,
    },
    activeRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TestRun',
      default: null,
    },
    currentStep: {
      type: String,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    metrics: {
      jobsCompleted: { type: Number, default: 0 },
      jobsFailed: { type: Number, default: 0 },
      uptimeSeconds: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.WorkerHeartbeat || mongoose.model('WorkerHeartbeat', WorkerHeartbeatSchema);
