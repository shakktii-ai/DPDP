import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide user name'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Please provide email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: false,
      select: false
    },
    role: {
      type: String,
      enum: [
        'user',
        'organization_owner',
        'assessment_reviewer',
        'platform_administrator'
      ],
      default: 'user'
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending'],
      default: 'active'
    },
    lastLogin: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Prevent model overwrite during Next.js hot module reloads
const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default User;
