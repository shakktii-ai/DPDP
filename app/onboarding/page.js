'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Globe,
  FileText,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Lock,
  Plus,
  Trash2,
  Upload,
  Info,
  ShieldAlert,
  Sparkles
} from 'lucide-react';

const INITIAL_FEATURES = [
  { key: 'public_info', label: 'Public Information Pages (About, Services, FAQs)', enabled: true, notes: '' },
  { key: 'registration_login', label: 'User Registration or Authentication / Login', enabled: false, notes: '' },
  { key: 'contact_forms', label: 'Contact Forms & Inquiry Submissions', enabled: true, notes: '' },
  { key: 'booking_forms', label: 'Appointment Scheduling or Booking Forms', enabled: false, notes: '' },
  { key: 'payments', label: 'Payment Gateways & Financial Transactions', enabled: false, notes: '' },
  { key: 'user_profiles', label: 'User Profiles & Personal Dashboard Area', enabled: false, notes: '' },
  { key: 'file_uploads', label: 'User File Uploads (KYC, Documents, Resumes)', enabled: false, notes: '' },
  { key: 'newsletter_marketing', label: 'Newsletter Signups & Marketing Subscriptions', enabled: false, notes: '' },
  { key: 'cookies_analytics', label: 'Cookies, Tracking Tags & Analytics Beacons', enabled: true, notes: '' },
  { key: 'third_party_integrations', label: 'Third-Party SDKs, Social Logins & Embedded Widgets', enabled: false, notes: '' },
  { key: 'account_deletion_data_request', label: 'Account Deletion & Data Principal Rights Workflows (Sec 12)', enabled: false, notes: '' }
];

const ASSESSMENT_MODES = [
  {
    id: 'website_with_documents',
    title: 'Website + Supplied Documents (Recommended)',
    desc: 'Combines dynamic website crawl with statutory cross-examination of uploaded privacy policies and consent notices.'
  },
  {
    id: 'website_only',
    title: 'Website-Only Inspection',
    desc: 'Examines publicly reachable web pages, cookie consent banners, and tracking beacons without document review.'
  },
  {
    id: 'authorized_login_testing',
    title: 'Authorized Login Workflow Testing',
    desc: 'Inspects authenticated user dashboards and account profile pages with provided test credentials.'
  },
  {
    id: 'manual_evidence_review',
    title: 'Manual Evidence Review',
    desc: 'Human compliance assessor cross-examines policy documents and visual screenshots against DPDP clauses.'
  },
  {
    id: 'combined_assessment',
    title: 'Combined Automated & Manual Assessment',
    desc: 'Full hybrid audit combining browser telemetry, AI vision inspection, and expert reviewer verification.'
  }
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Organization Data
  const [orgData, setOrgData] = useState({
    name: '',
    legalEntityName: '',
    organizationType: 'Private Limited Company',
    industry: 'SaaS & Cloud Services',
    description: '',
    dpdpRegistrationNumber: '',
    contactEmail: '',
    contactPhone: '',
    contactAddress: '',
    city: '',
    state: '',
    postalCode: '',
    // DPO / Privacy Officer
    privacyOfficerName: '',
    privacyOfficerEmail: '',
    privacyOfficerPhone: '',
    // Grievance Officer (Mandatory under DPDP Act Sec 8(9))
    grievanceOfficerName: '',
    grievanceOfficerEmail: '',
    grievanceOfficerPhone: '',
    grievanceOfficerAddress: '',
    // Representative confirmation
    repName: '',
    repDesignation: '',
    repConfirmed: true
  });

  // Step 2: Website & Features
  const [websiteData, setWebsiteData] = useState({
    url: '',
    purpose: '',
    features: INITIAL_FEATURES,
    hasOtherFeatures: false,
    otherFeaturesDescription: ''
  });

  // Step 3: Privacy Documents
  const [documents, setDocuments] = useState([
    { documentType: 'privacy_policy', title: 'Privacy Policy', sourceType: 'url', url: '', extractedText: '' },
    { documentType: 'terms_of_service', title: 'Terms of Service', sourceType: 'url', url: '', extractedText: '' },
    { documentType: 'consent_notice', title: 'Consent Notice (Sec 6)', sourceType: 'url', url: '', extractedText: '' }
  ]);

  // Step 4: Approved Target & Authorization
  const [targetScope, setTargetScope] = useState({
    scopes: ['public_pages', 'cookie_consent_banners', 'tracking_scripts', 'privacy_policy'],
    excludedPaths: '/admin, /internal, /api/private',
    authorizationAffirmed: true
  });

  // Step 5: Assessment Configuration
  const [assessmentConfig, setAssessmentConfig] = useState({
    mode: 'website_with_documents',
    hasLoginTesting: false,
    loginUrl: '',
    loginInstructions: ''
  });

  // Step Handlers
  const handleOrgChange = (e) => {
    const { name, value, type, checked } = e.target;
    setOrgData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleFeatureToggle = (key) => {
    setWebsiteData((prev) => ({
      ...prev,
      features: prev.features.map((f) =>
        f.key === key ? { ...f, enabled: !f.enabled } : f
      )
    }));
  };

  const handleDocumentChange = (index, field, value) => {
    setDocuments((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addDocumentRow = () => {
    setDocuments((prev) => [
      ...prev,
      { documentType: 'other', title: 'Additional Policy', sourceType: 'url', url: '', extractedText: '' }
    ]);
  };

  const removeDocumentRow = (index) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  // Step validation
  const validateStep = (step) => {
    setError('');
    if (step === 1) {
      if (!orgData.name.trim()) {
        setError('Organization Name is required.');
        return false;
      }
      if (!orgData.contactEmail.trim()) {
        setError('Official Contact Email is required.');
        return false;
      }
      if (!orgData.repConfirmed) {
        setError('You must confirm authorized representation of the entity.');
        return false;
      }
    } else if (step === 2) {
      if (!websiteData.url.trim() || !/^https?:\/\//i.test(websiteData.url.trim())) {
        setError('A valid website URL starting with http:// or https:// is required.');
        return false;
      }
      // SSRF check on frontend as immediate validation
      const lower = websiteData.url.toLowerCase();
      if (
        lower.includes('localhost') ||
        lower.includes('127.0.0.1') ||
        lower.includes('169.254.169.254') ||
        lower.includes('10.') ||
        lower.includes('192.168.')
      ) {
        setError('Internal hostnames, loopbacks, and private IP ranges cannot be targeted for external assessment.');
        return false;
      }
    } else if (step === 4) {
      if (!targetScope.authorizationAffirmed) {
        setError('Explicit statutory testing authorization is required under the DPDP Act 2023.');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 6));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setError('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Submit full onboarding bundle
  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);

    try {
      const payload = {
        name: orgData.name,
        legalEntityName: orgData.legalEntityName,
        organizationType: orgData.organizationType,
        industry: orgData.industry,
        description: orgData.description,
        dpdpRegistrationNumber: orgData.dpdpRegistrationNumber,
        contactDetails: {
          email: orgData.contactEmail,
          phone: orgData.contactPhone,
          address: orgData.contactAddress,
          city: orgData.city,
          state: orgData.state,
          postalCode: orgData.postalCode
        },
        dataProtectionOfficer: {
          name: orgData.privacyOfficerName,
          email: orgData.privacyOfficerEmail,
          phone: orgData.privacyOfficerPhone
        },
        grievanceOfficer: {
          name: orgData.grievanceOfficerName,
          email: orgData.grievanceOfficerEmail,
          phone: orgData.grievanceOfficerPhone,
          physicalAddress: orgData.grievanceOfficerAddress
        },
        websiteUrl: websiteData.url,
        websitePurpose: websiteData.purpose,
        websiteFeatures: websiteData.features,
        hasOtherFeatures: websiteData.hasOtherFeatures,
        otherFeaturesDescription: websiteData.otherFeaturesDescription,
        documents: documents.filter((d) => d.url.trim() || d.extractedText.trim()),
        excludedPaths: targetScope.excludedPaths.split(',').map((p) => p.trim()).filter(Boolean),
        authorizationAffirmed: targetScope.authorizationAffirmed,
        assessmentMode: assessmentConfig.mode,
        loginTestingConfig: {
          enabled: assessmentConfig.mode === 'authorized_login_testing',
          loginUrl: assessmentConfig.loginUrl,
          instructions: assessmentConfig.loginInstructions
        }
      };

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete onboarding');
      }

      // Route to testing dashboard or assessment launch
      const newAssessmentId = data.data?.assessment?._id;
      if (newAssessmentId) {
        router.push(`/testing?id=${newAssessmentId}`);
      } else {
        router.push('/admin');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS_NAV = [
    { num: 1, title: 'Entity Profile', icon: Building2 },
    { num: 2, title: 'Website Features', icon: Globe },
    { num: 3, title: 'Privacy Docs', icon: FileText },
    { num: 4, title: 'Target Authorization', icon: ShieldCheck },
    { num: 5, title: 'Assessment Scope', icon: Sliders },
    { num: 6, title: 'Review & Start', icon: CheckCircle2 }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          Organization Onboarding & Assessment Setup
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Complete the DPDP Act 2023 statutory onboarding to authorize your domain, register data fiduciary details, and configure the automated assessment pipeline.
        </p>
      </div>

      {/* Wizard Step Progression Bar */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 overflow-x-auto shadow-xs">
        <div className="flex items-center justify-between min-w-[620px]">
          {STEPS_NAV.map((s, idx) => {
            const Icon = s.icon;
            const isCurrent = currentStep === s.num;
            const isCompleted = currentStep > s.num;

            return (
              <div key={s.num} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (s.num < currentStep) setCurrentStep(s.num);
                  }}
                  disabled={s.num > currentStep}
                  className={`flex items-center gap-2 text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'text-[#2d523e]'
                      : isCompleted
                      ? 'text-[#2d523e]'
                      : 'text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border transition-all ${
                      isCurrent
                        ? 'bg-[#eaf2ed] text-[#2d523e] border-[#d0e2d5]'
                        : isCompleted
                        ? 'bg-[#2d523e] text-white border-[#2d523e]'
                        : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                  </div>
                  <span>{s.title}</span>
                </button>
                {idx < STEPS_NAV.length - 1 && (
                  <div
                    className={`flex-1 h-[2px] mx-3 transition-all ${
                      isCompleted ? 'bg-[#2d523e]/40' : 'bg-slate-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: Organization Profile */}
      {currentStep === 1 && (
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#2d523e]" />
              <span>Step 1: Organization & Data Fiduciary Details</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Statutory identification, DPO, and grievance officer appointments under DPDP Act Section 8(9).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Organization Trade Name *
              </label>
              <input
                type="text"
                name="name"
                required
                value={orgData.name}
                onChange={handleOrgChange}
                placeholder="Arogya Healthcare"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Legal Entity Name
              </label>
              <input
                type="text"
                name="legalEntityName"
                value={orgData.legalEntityName}
                onChange={handleOrgChange}
                placeholder="Arogya Healthcare India Pvt Ltd"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Organization Entity Type
              </label>
              <select
                name="organizationType"
                value={orgData.organizationType}
                onChange={handleOrgChange}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
              >
                <option value="Private Limited Company">Private Limited Company</option>
                <option value="Public Limited Company">Public Limited Company</option>
                <option value="Limited Liability Partnership (LLP)">LLP</option>
                <option value="Sole Proprietorship / Partnership">Sole Proprietorship</option>
                <option value="Non-Profit / Section 8">Non-Profit / Section 8</option>
                <option value="Government / Public Sector">Government / Public Sector</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Industry Sector
              </label>
              <select
                name="industry"
                value={orgData.industry}
                onChange={handleOrgChange}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
              >
                <option value="SaaS & Cloud Services">SaaS & Cloud Services</option>
                <option value="Healthcare / HealthTech">Healthcare / HealthTech</option>
                <option value="Fintech / Banking">Fintech / Banking</option>
                <option value="E-commerce & Retail">E-commerce & Retail</option>
                <option value="EdTech">EdTech</option>
                <option value="Telecommunications">Telecommunications</option>
                <option value="Government & Public Sector">Government</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                CIN / DPDP Fiduciary Reg No.
              </label>
              <input
                type="text"
                name="dpdpRegistrationNumber"
                value={orgData.dpdpRegistrationNumber}
                onChange={handleOrgChange}
                placeholder="U85110MH2024PTC123456"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Organization Description
            </label>
            <textarea
              name="description"
              rows={2}
              value={orgData.description}
              onChange={handleOrgChange}
              placeholder="Brief description of digital services and data fiduciary scope..."
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
            />
          </div>

          {/* Contact Details */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Official Contact Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <input
                  type="email"
                  name="contactEmail"
                  required
                  placeholder="Official Email *"
                  value={orgData.contactEmail}
                  onChange={handleOrgChange}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="tel"
                  name="contactPhone"
                  placeholder="Phone Number"
                  value={orgData.contactPhone}
                  onChange={handleOrgChange}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="text"
                  name="city"
                  placeholder="City (e.g. Pune / Mumbai)"
                  value={orgData.city}
                  onChange={handleOrgChange}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Privacy Officer & Grievance Officer */}
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <h5 className="text-xs font-semibold text-[#2d523e] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Privacy Contact / DPO</span>
              </h5>
              <input
                type="text"
                name="privacyOfficerName"
                placeholder="DPO Name"
                value={orgData.privacyOfficerName}
                onChange={handleOrgChange}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
              />
              <input
                type="email"
                name="privacyOfficerEmail"
                placeholder="dpo@company.com"
                value={orgData.privacyOfficerEmail}
                onChange={handleOrgChange}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
              />
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <h5 className="text-xs font-semibold text-[#2d523e] flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Grievance Redressal Officer (Sec 8(9))</span>
              </h5>
              <input
                type="text"
                name="grievanceOfficerName"
                placeholder="Grievance Officer Name"
                value={orgData.grievanceOfficerName}
                onChange={handleOrgChange}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
              />
              <input
                type="email"
                name="grievanceOfficerEmail"
                placeholder="grievance@company.com"
                value={orgData.grievanceOfficerEmail}
                onChange={handleOrgChange}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
              />
            </div>
          </div>

          {/* Representative Confirmation */}
          <div className="p-3.5 rounded-lg bg-[#2d523e]/5 border border-[#2d523e]/20">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="repConfirmed"
                checked={orgData.repConfirmed}
                onChange={handleOrgChange}
                className="mt-1 rounded border-slate-300 text-[#2d523e] focus:ring-[#2d523e]"
              />
              <div className="text-xs text-slate-700 leading-relaxed">
                <strong className="text-slate-900 block font-semibold">
                  Authorized Representative Confirmation
                </strong>
                I confirm that I am an authorized representative of this organization and authorized to initiate DPDP assessment procedures.
              </div>
            </label>
          </div>
        </div>
      )}

      {/* STEP 2: Website Details & Feature Selection */}
      {currentStep === 2 && (
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#2d523e]" />
              <span>Step 2: Website Scope & Functional Modules</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify website URL and select active features for targeted DPDP compliance checks.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Primary Website URL under Assessment *
              </label>
              <input
                type="url"
                required
                value={websiteData.url}
                onChange={(e) => setWebsiteData((p) => ({ ...p, url: e.target.value }))}
                placeholder="https://example.com"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Target must be publicly accessible via HTTP/HTTPS. Localhost and private IP ranges are blocked by SSRF filters.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Website Purpose & Target Audience
              </label>
              <input
                type="text"
                value={websiteData.purpose}
                onChange={(e) => setWebsiteData((p) => ({ ...p, purpose: e.target.value }))}
                placeholder="e.g. Healthcare telehealth consultations and appointment booking"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
              />
            </div>
          </div>

          {/* 11 Required Website Feature Checkboxes */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span>Website Features & Data Collection Points</span>
              <span className="text-[#2d523e] font-mono text-[11px]">
                {websiteData.features.filter((f) => f.enabled).length} Selected
              </span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {websiteData.features.map((feature) => (
                <div
                  key={feature.key}
                  onClick={() => handleFeatureToggle(feature.key)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    feature.enabled
                      ? 'bg-[#eaf2ed] border-[#d0e2d5] text-slate-900 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={feature.enabled}
                    onChange={() => {}} // Handled by parent container click
                    className="mt-0.5 rounded border-slate-300 text-[#2d523e] focus:ring-[#2d523e]"
                  />
                  <span className="text-xs leading-tight font-medium">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Other Feature Option */}
            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={websiteData.hasOtherFeatures}
                  onChange={(e) =>
                    setWebsiteData((p) => ({ ...p, hasOtherFeatures: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-[#2d523e]"
                />
                <span>Other specialized features or data collection workflows</span>
              </label>

              {websiteData.hasOtherFeatures && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={websiteData.otherFeaturesDescription}
                    onChange={(e) =>
                      setWebsiteData((p) => ({ ...p, otherFeaturesDescription: e.target.value }))
                    }
                    placeholder="Describe other features (e.g. AI chatbots, biometric sensors, geolocation tracking)"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Privacy Documents */}
      {currentStep === 3 && (
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#2d523e]" />
                <span>Step 3: Privacy Documents & Regulatory Policies</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Supply URLs or policy texts for automated cross-examination against website consent modals.
              </p>
            </div>
            <button
              type="button"
              onClick={addDocumentRow}
              className="text-xs text-[#2d523e] hover:text-[#1e382a] font-semibold inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Document</span>
            </button>
          </div>

          <div className="space-y-4">
            {documents.map((doc, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <select
                      value={doc.documentType}
                      onChange={(e) => handleDocumentChange(idx, 'documentType', e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-medium focus:border-[#2d523e] focus:outline-none"
                    >
                      <option value="privacy_policy">Privacy Policy</option>
                      <option value="terms_of_service">Terms of Service</option>
                      <option value="consent_notice">Consent Notice (Sec 6)</option>
                      <option value="data_retention_policy">Data Retention Policy</option>
                      <option value="grievance_policy">Grievance Policy</option>
                      <option value="other">Other Document</option>
                    </select>

                    <input
                      type="text"
                      value={doc.title}
                      onChange={(e) => handleDocumentChange(idx, 'title', e.target.value)}
                      placeholder="Document Title"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleDocumentChange(idx, 'sourceType', doc.sourceType === 'url' ? 'upload' : 'url')
                      }
                      className="px-2.5 py-1 rounded text-[11px] font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                    >
                      {doc.sourceType === 'url' ? 'Switch to Text Input' : 'Switch to URL'}
                    </button>
                    {documents.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDocumentRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-500"
                        title="Remove Document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {doc.sourceType === 'url' ? (
                  <input
                    type="url"
                    value={doc.url}
                    onChange={(e) => handleDocumentChange(idx, 'url', e.target.value)}
                    placeholder="https://example.com/privacy-policy"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-xs focus:border-[#2d523e] focus:outline-none"
                  />
                ) : (
                  <textarea
                    rows={3}
                    value={doc.extractedText}
                    onChange={(e) => handleDocumentChange(idx, 'extractedText', e.target.value)}
                    placeholder="Paste policy document text or excerpt here..."
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-mono focus:border-[#2d523e] focus:outline-none"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 4: Target Authorization & SSRF Scope */}
      {currentStep === 4 && (
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#2d523e]" />
              <span>Step 4: Statutory Testing Authorization & Approved Target</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Establish legal authorization to test the domain and define permissible boundary scopes.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Target Domain to be Approved:</span>
              <span className="font-mono text-[#2d523e] font-bold">{websiteData.url || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">SSRF Safety Filter:</span>
              <span className="text-[#2d523e] font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2d523e]" />
                Active (Private ranges & metadata blocked)
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Excluded Paths or Workflows (Comma-separated)
            </label>
            <input
              type="text"
              value={targetScope.excludedPaths}
              onChange={(e) => setTargetScope((p) => ({ ...p, excludedPaths: e.target.value }))}
              placeholder="/admin, /checkout, /internal-api"
              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-xs focus:border-[#2d523e] focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Assessment crawlers will strictly avoid crawling or testing these URL prefixes.
            </p>
          </div>

          {/* Statutory Warranty Affirmation */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={targetScope.authorizationAffirmed}
                onChange={(e) =>
                  setTargetScope((p) => ({ ...p, authorizationAffirmed: e.target.checked }))
                }
                className="mt-1 rounded border-slate-300 text-[#2d523e] focus:ring-[#2d523e]"
              />
              <div className="text-xs text-slate-700 leading-relaxed">
                <strong className="text-slate-900 block font-semibold mb-0.5">
                  Statutory Authorization & Legal Warranty (DPDP Act 2023)
                </strong>
                I solemnly affirm that our organization owns, operates, or holds formal legal authorization to evaluate the target domain. Automated assessment activities are authorized solely for DPDP compliance audit and privacy gap identification.
              </div>
            </label>
          </div>
        </div>
      )}

      {/* STEP 5: Assessment Configuration */}
      {currentStep === 5 && (
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#2d523e]" />
              <span>Step 5: Assessment Mode Configuration</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the assessment depth and audit methodology.
            </p>
          </div>

          <div className="space-y-3">
            {ASSESSMENT_MODES.map((mode) => (
              <div
                key={mode.id}
                onClick={() => setAssessmentConfig((p) => ({ ...p, mode: mode.id }))}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  assessmentConfig.mode === mode.id
                    ? 'bg-[#eaf2ed] border-[#d0e2d5] shadow-xs'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">{mode.title}</h4>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      assessmentConfig.mode === mode.id
                        ? 'border-[#2d523e] bg-[#2d523e]'
                        : 'border-slate-400'
                    }`}
                  >
                    {assessmentConfig.mode === mode.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{mode.desc}</p>
              </div>
            ))}
          </div>

          {/* Conditional Login Testing Configuration */}
          {assessmentConfig.mode === 'authorized_login_testing' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h5 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Authorized Login Workflow Details
              </h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="url"
                  placeholder="Login Page URL (e.g. https://example.com/login)"
                  value={assessmentConfig.loginUrl}
                  onChange={(e) =>
                    setAssessmentConfig((p) => ({ ...p, loginUrl: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-mono focus:border-[#2d523e] focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Testing Instructions / Demo User ID"
                  value={assessmentConfig.loginInstructions}
                  onChange={(e) =>
                    setAssessmentConfig((p) => ({ ...p, loginInstructions: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 6: Review & Finalize */}
      {currentStep === 6 && (
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-6 shadow-xs">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#2d523e]" />
              <span>Step 6: Review & Onboard Data Fiduciary</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review your configuration summary before saving your Approved Target and Assessment Profile.
            </p>
          </div>

          <div className="space-y-4 text-xs">
            {/* Entity Summary */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">{orgData.name}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
                  {orgData.industry}
                </span>
              </div>
              <p className="text-slate-600">
                Legal Entity: <span className="text-slate-800 font-medium">{orgData.legalEntityName || orgData.name}</span> &bull;{' '}
                Type: <span className="text-slate-800 font-medium">{orgData.organizationType}</span>
              </p>
              <div className="text-slate-500 pt-1 flex flex-wrap gap-4">
                <span>DPO: <strong className="text-slate-700">{orgData.privacyOfficerEmail || 'Not designated'}</strong></span>
                <span>Grievance Officer: <strong className="text-slate-700">{orgData.grievanceOfficerEmail || 'Not designated'}</strong></span>
              </div>
            </div>

            {/* Target & Feature Summary */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Target Website & Domain</span>
                <span className="font-mono text-[#2d523e] font-bold">{websiteData.url}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Active Website Modules</span>
                <span className="text-slate-800 font-medium">
                  {websiteData.features.filter((f) => f.enabled).length} modules selected
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Assessment Execution Mode</span>
                <span className="text-[#2d523e] font-medium capitalize">
                  {assessmentConfig.mode.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Supplied Privacy Documents</span>
                <span className="text-slate-800 font-medium">
                  {documents.filter((d) => d.url || d.extractedText).length} document(s)
                </span>
              </div>
            </div>

            {/* Statutory Status Pill */}
            <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="text-[11px] text-emerald-800 leading-tight">
                <strong>Statutory Pre-requisites Satisfied:</strong> ApprovedTarget will be initialized with authorized domain status, and SSRF mitigations will be active during all crawl operations.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <div>
          {currentStep > 1 && (
            <button
              type="button"
              onClick={prevStep}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Step</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            Cancel
          </Link>

          {currentStep < 6 ? (
            <button
              type="button"
              onClick={nextStep}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234131] text-white shadow-xs transition-all"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-7 py-2.5 rounded-lg text-sm font-semibold bg-[#2d523e] hover:bg-[#234131] text-white shadow-xs transition-all disabled:opacity-50"
            >
              {submitting ? (
                <span>Onboarding & Persisting...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Save Profile & Launch Assessment</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
