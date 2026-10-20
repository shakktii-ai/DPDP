import mongoose from 'mongoose';

const WebsiteSubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Website identifier or name is required'],
      trim: true
    },
    url: {
      type: String,
      required: [true, 'Website URL is required'],
      trim: true,
      match: [
        /^https?:\/\/.+/,
        'Please enter a valid HTTP or HTTPS website URL'
      ]
    },
    purpose: {
      type: String,
      trim: true
    },
    isAuthorized: {
      type: Boolean,
      default: false
    },
    authorizedAt: {
      type: Date
    },
    authorizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    scopeDescription: {
      type: String,
      default: 'Full public domain assessment including privacy notice, consent managers, and tracking scripts'
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'archived'],
      default: 'active'
    }
  },
  { _id: true, timestamps: true }
);

const OrganizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: [150, 'Organization name cannot exceed 150 characters'],
      index: true
    },
    legalEntityName: {
      type: String,
      trim: true
    },
    organizationType: {
      type: String,
      enum: [
        'Private Limited Company',
        'Public Limited Company',
        'Limited Liability Partnership (LLP)',
        'Sole Proprietorship / Partnership',
        'Non-Profit / Section 8',
        'Government / Public Sector',
        'Other'
      ],
      default: 'Private Limited Company'
    },
    industry: {
      type: String,
      enum: [
        'Fintech / Banking',
        'Healthcare / HealthTech',
        'E-commerce & Retail',
        'SaaS & Cloud Services',
        'EdTech',
        'Telecommunications',
        'Government & Public Sector',
        'Media & Entertainment',
        'Other'
      ],
      default: 'SaaS & Cloud Services'
    },
    description: {
      type: String,
      trim: true
    },
    dpdpRegistrationNumber: {
      type: String,
      trim: true,
      description: 'Data Fiduciary Identification Number or CIN'
    },
    websiteUrl: {
      type: String,
      trim: true
    },
    websitePurpose: {
      type: String,
      trim: true
    },
    contactDetails: {
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      postalCode: { type: String, trim: true },
      country: { type: String, default: 'India' }
    },
    // General Data Protection Officer (DPO) under Sec 8(9)
    dataProtectionOfficer: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      physicalAddress: { type: String, trim: true }
    },
    // Privacy Contact
    privacyOfficer: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true }
    },
    // Grievance Redressal Officer (Mandatory under DPDP Act Sec 8(9) / Rule 4)
    grievanceOfficer: {
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      physicalAddress: { type: String, trim: true }
    },
    // Authorized representative affirmation
    authorizedRepresentativeConfirmation: {
      confirmed: { type: Boolean, default: false },
      representativeName: { type: String, trim: true },
      designation: { type: String, trim: true },
      confirmedAt: { type: Date }
    },
    registeredWebsites: [WebsiteSubSchema],
    status: {
      type: String,
      enum: ['active', 'pending_verification', 'suspended'],
      default: 'active',
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

OrganizationSchema.index({ 'registeredWebsites.url': 1 });

const Organization =
  mongoose.models.Organization ||
  mongoose.model('Organization', OrganizationSchema);

export default Organization;
