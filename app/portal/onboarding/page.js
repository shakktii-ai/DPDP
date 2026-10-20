'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  Globe,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  AlertCircle,
  HelpCircle,
  Lock,
  X,
  FileCheck,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Info
} from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Organization', subtitle: 'Business identity' },
  { id: 2, title: 'Website', subtitle: 'Domain & features' },
  { id: 3, title: 'Documents', subtitle: 'Privacy policies' },
  { id: 4, title: 'Testing Scope', subtitle: 'Domain authorization' },
  { id: 5, title: 'Review & Start', subtitle: 'Confirm assessment' },
];

export default function CustomerOnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [existingOrganization, setExistingOrganization] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  // Step 1: Organization State
  const [orgData, setOrgData] = useState({
    name: '',
    legalEntityName: '',
    organizationType: 'Private Limited Company',
    industry: 'Fintech / Banking',
    contactPerson: '',
    contactEmail: '',
    country: 'India',
  });

  // Step 2: Website State
  const [webData, setWebData] = useState({
    websiteName: '',
    websiteUrl: '',
    websitePurpose: '',
    features: {
      cookies_analytics: true,
      contact_forms: true,
      registration_login: false,
      newsletter_marketing: false,
      user_profiles: false,
      account_deletion_data_request: false,
    },
    dataCategories: {
      identity_contact: true,
      cookie_telemetry: true,
      financial: false,
      health_biometric: false,
    },
  });

  // Step 2: Conditional Test Account Credentials State
  const [authTesting, setAuthTesting] = useState({
    skipAuthenticatedTesting: false, // Default to prompting for credentials when login feature is enabled
    method: 'password', // 'password' | 'sso_mfa_other'
    loginUrl: '',
    username: '',
    password: '',
    showPassword: false,
    authorizedConfirmation: false,
  });

  // Step 3: Privacy Documents State
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [docNotes, setDocNotes] = useState('');

  // Step 4: Testing Scope State
  const [scopeData, setScopeData] = useState({
    authorized: false,
    allowedPaths: '/, /privacy, /consent, /contact, /login, /grievance',
    excludedPaths: '/admin, /internal, /checkout/pay',
    scopeDescription: 'Automated client-side inspection of public pages, cookie banners, and disclosures.',
  });

  // Validation errors
  const [errors, setErrors] = useState({});

  // Auto-detect existing organization for customer so they don't re-enter it repeatedly
  useEffect(() => {
    async function loadOrgInfo() {
      try {
        setLoadingOrg(true);
        const [meRes, orgsRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/organizations'),
        ]);

        const meJson = await meRes.json();
        const orgsJson = await orgsRes.json();

        let foundOrg = null;
        if (meJson.success && meJson.user?.organization) {
          const userOrg = meJson.user.organization;
          const userOrgId = typeof userOrg === 'object' ? userOrg._id || userOrg.id : userOrg;
          if (orgsJson.success && Array.isArray(orgsJson.data)) {
            foundOrg = orgsJson.data.find((o) => String(o._id) === String(userOrgId));
          }
          if (!foundOrg && typeof userOrg === 'object' && userOrg.name) {
            foundOrg = userOrg;
          }
        }

        if (!foundOrg && orgsJson.success && Array.isArray(orgsJson.data) && orgsJson.data.length > 0) {
          foundOrg = orgsJson.data[0];
        }

        if (foundOrg) {
          setExistingOrganization(foundOrg);
          setOrgData((prev) => ({
            name: foundOrg.name || prev.name,
            legalEntityName: foundOrg.legalEntityName || foundOrg.name || prev.legalEntityName,
            organizationType: foundOrg.organizationType || prev.organizationType,
            industry: foundOrg.industry || prev.industry,
            contactPerson:
              foundOrg.contactDetails?.primaryContactPerson ||
              foundOrg.privacyOfficer?.name ||
              prev.contactPerson,
            contactEmail:
              foundOrg.contactDetails?.email ||
              foundOrg.privacyOfficer?.email ||
              prev.contactEmail,
            country: foundOrg.contactDetails?.country || prev.country,
          }));

          // Default straight to Step 2 so existing organization doesn't need to be filled again
          if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(window.location.search);
            if (searchParams.get('step') !== '1') {
              setCurrentStep(2);
            }
          }
        }
      } catch (err) {
        console.warn('Could not auto-fetch organization:', err);
      } finally {
        setLoadingOrg(false);
      }
    }

    loadOrgInfo();
  }, []);

  const validateStep = (step) => {
    const errs = {};
    if (step === 1) {
      if (!orgData.name.trim()) errs.name = 'Business or organization name is required.';
      if (!orgData.contactPerson.trim()) errs.contactPerson = 'Contact person name is required.';
      if (!orgData.contactEmail.trim() || !orgData.contactEmail.includes('@')) {
        errs.contactEmail = 'Valid business email is required.';
      }
    } else if (step === 2) {
      if (!webData.websiteName.trim()) errs.websiteName = 'Website name is required.';
      if (!webData.websiteUrl.trim()) {
        errs.websiteUrl = 'Website URL is required.';
      } else if (!/^https?:\/\/.+/i.test(webData.websiteUrl)) {
        errs.websiteUrl = 'URL must begin with http:// or https:// (e.g. https://example.com)';
      }
      if (!webData.websitePurpose.trim()) {
        errs.websitePurpose = 'Please provide a short description of the website purpose.';
      }

      // Validate conditional credentials if login feature is enabled and testing credentials provided
      if (webData.features.registration_login && !authTesting.skipAuthenticatedTesting) {
        if (authTesting.method === 'password' || !authTesting.method) {
          if (!authTesting.loginUrl.trim()) {
            errs.loginUrl = 'Login page URL is required for authenticated testing.';
          } else {
            const trimmedLogin = authTesting.loginUrl.trim();
            if (!trimmedLogin.startsWith('/')) {
              if (!/^https?:\/\/.+/i.test(trimmedLogin)) {
                errs.loginUrl = 'URL must begin with http:// or https:// or be a relative path (e.g. /login).';
              } else {
                try {
                  const baseHost = new URL(webData.websiteUrl).hostname.toLowerCase();
                  const loginHost = new URL(trimmedLogin).hostname.toLowerCase();
                  const isMatch =
                    loginHost === baseHost ||
                    loginHost.endsWith(`.${baseHost}`) ||
                    baseHost.endsWith(`.${loginHost}`);
                  if (!isMatch) {
                    errs.loginUrl = `Login URL domain (${loginHost}) must belong to the approved website (${baseHost}).`;
                  }
                } catch {
                  errs.loginUrl = 'Invalid URL format.';
                }
              }
            }
          }

          if (!authTesting.username.trim()) {
            errs.loginUsername = 'Test account username or email is required.';
          }

          if (!authTesting.password.trim()) {
            errs.loginPassword = 'Test account password is required.';
          }

          if (!authTesting.authorizedConfirmation) {
            errs.loginAuthorized = 'You must confirm that these are authorized test credentials.';
          }
        }
      }
    } else if (step === 4) {
      if (!scopeData.authorized) {
        errs.authorized = 'You must confirm that you own or are authorized to test this website.';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setErrorMessage('');
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const handleBack = () => {
    setErrorMessage('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // Document Upload Handler (reads real file text for evidence extraction)
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      setUploading(true);
      for (const file of Array.from(files)) {
        // Validate file size (< 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`File ${file.name} exceeds 10MB limit.`);
          continue;
        }

        const fileText = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result || '');
          reader.onerror = () => resolve('');
          reader.readAsText(file);
        });

        setUploadedFiles((prev) => [
          ...prev,
          {
            _id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            title: file.name,
            originalFileName: file.name,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type || 'text/plain',
            sourceType: 'upload',
            extractedText: typeof fileText === 'string' ? fileText.slice(0, 100000) : '',
          },
        ]);
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id) => {
    setUploadedFiles((prev) => prev.filter((f) => f._id !== id));
  };

  // Submit and Start Assessment
  const handleStartAssessment = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);
      setErrorMessage('');

      // Build features array for existing backend model
      const websiteFeatures = [
        { key: 'cookies_analytics', label: 'Cookies & Analytics', enabled: webData.features.cookies_analytics },
        { key: 'contact_forms', label: 'Contact Forms', enabled: webData.features.contact_forms },
        { key: 'registration_login', label: 'Registration & Login', enabled: webData.features.registration_login },
        { key: 'newsletter_marketing', label: 'Newsletter & Marketing', enabled: webData.features.newsletter_marketing },
        { key: 'user_profiles', label: 'User Profiles', enabled: webData.features.user_profiles },
        { key: 'account_deletion_data_request', label: 'Account Deletion Flow', enabled: webData.features.account_deletion_data_request },
      ];

      // Prepare Login Testing Configuration
      const isLoginFeatureEnabled = Boolean(webData.features.registration_login);
      const isAuthTestingProvided = isLoginFeatureEnabled && !authTesting.skipAuthenticatedTesting;
      const loginTestingConfig = {
        enabled: isAuthTestingProvided,
        authMethod: !isAuthTestingProvided ? 'public_only' : authTesting.method,
        loginUrl: isAuthTestingProvided ? (authTesting.loginUrl || `${webData.websiteUrl}/login`) : undefined,
        username: isAuthTestingProvided && authTesting.method === 'password' ? authTesting.username.trim() : undefined,
        password: isAuthTestingProvided && authTesting.method === 'password' ? authTesting.password : undefined,
        skipAuthenticatedTesting: !isAuthTestingProvided,
        authorizedConfirmation: isAuthTestingProvided ? Boolean(authTesting.authorizedConfirmation) : false,
      };

      // 1. Submit Onboarding Data
      const onboardingPayload = {
        organizationId: existingOrganization?._id || undefined,
        name: orgData.name,
        legalEntityName: orgData.legalEntityName || orgData.name,
        organizationType: orgData.organizationType,
        industry: orgData.industry,
        contactDetails: {
          email: orgData.contactEmail,
          primaryContactPerson: orgData.contactPerson,
          country: orgData.country,
        },
        privacyOfficer: {
          name: orgData.contactPerson,
          email: orgData.contactEmail,
        },
        grievanceOfficer: {
          name: orgData.contactPerson,
          email: orgData.contactEmail,
        },
        websiteUrl: webData.websiteUrl,
        websitePurpose: webData.websitePurpose,
        websiteFeatures,
        privacyDocuments: uploadedFiles.map((f) => ({
          title: f.title || f.fileName,
          fileName: f.fileName || f.originalFileName,
          sourceType: 'upload',
          mimeType: f.mimeType || 'text/plain',
          sizeBytes: f.fileSize || 0,
          extractedText: f.extractedText || undefined,
        })),
        approvedScope: scopeData.allowedPaths.split(',').map((p) => p.trim()),
        excludedPaths: scopeData.excludedPaths.split(',').map((p) => p.trim()),
        authorizationConfirmation: true,
        assessmentMode: isAuthTestingProvided ? 'authorized_login_testing' : 'website_with_documents',
        scopeSummary: scopeData.scopeDescription,
        loginTestingConfig,
      };

      const onboardRes = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(onboardingPayload),
      });

      const onboardJson = await onboardRes.json();
      if (!onboardJson.success) {
        throw new Error(onboardJson.error || 'Failed to complete onboarding');
      }

      const targetId = onboardJson.data.approvedTarget._id;
      const organizationId = onboardJson.data.organization._id;

      // 2. Queue Assessment Run via /api/runs
      const runRes = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId,
          options: {
            maxPages: 10,
            timeoutSeconds: 120,
            credentials: {
              enabled: isAuthTestingProvided,
              authMethod: !isAuthTestingProvided ? 'public_only' : authTesting.method,
              loginUrl: isAuthTestingProvided ? (authTesting.loginUrl || `${webData.websiteUrl}/login`) : undefined,
              username: isAuthTestingProvided && authTesting.method === 'password' ? authTesting.username.trim() : undefined,
              password: isAuthTestingProvided && authTesting.method === 'password' ? authTesting.password : undefined,
              skipAuthenticatedTesting: !isAuthTestingProvided,
            },
          },
        }),
      });

      const runJson = await runRes.json();
      if (!runJson.success) {
        throw new Error(runJson.error || 'Failed to queue assessment test run');
      }

      const assessmentId = runJson.testRun?.assessmentId?._id || runJson.testRun?.assessmentId || targetId;

      // 3. Redirect customer to real-time progress page
      router.push(`/portal/assessments/${assessmentId}`);
    } catch (err) {
      console.error('Onboarding start error:', err);
      setErrorMessage(err.message || 'Something went wrong while starting the assessment. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {/* Wizard Header */}
      <div className="space-y-2 text-center">
        <span className="text-xs font-semibold text-[#2d523e] uppercase tracking-wider">
          Customer Onboarding
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">
          Setup Your Website Privacy Assessment
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 max-w-lg mx-auto">
          Complete the steps below to configure your authorized website domain, privacy features, and assessment scope.
        </p>
      </div>

      {/* Progress Stepper Bar */}
      <div className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;

            return (
              <div key={step.id} className="flex-1 flex flex-col items-center relative">
                <button
                  type="button"
                  onClick={() => {
                    if (step.id < currentStep) setCurrentStep(step.id);
                  }}
                  disabled={step.id > currentStep}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    isCompleted
                      ? 'bg-[#2d523e] text-white'
                      : isCurrent
                      ? 'bg-[#eaf2ed] text-[#2d523e] border-2 border-[#2d523e]'
                      : 'bg-stone-100 text-stone-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : step.id}
                </button>
                <span
                  className={`text-[11px] font-medium mt-1.5 hidden sm:block ${
                    isCurrent ? 'text-stone-900 font-semibold' : 'text-stone-500'
                  }`}
                >
                  {step.title}
                </span>

                {/* Connecting Line */}
                {idx < STEPS.length - 1 && (
                  <div
                    className={`hidden sm:block absolute top-4 left-1/2 w-full h-[2px] -z-0 ${
                      currentStep > step.id ? 'bg-[#2d523e]' : 'bg-stone-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Alert Box */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">Assessment Setup Error</span>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Step Forms */}
      <div className="p-6 sm:p-8 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-6">
        {/* ==================================================== */}
        {/* STEP 1: ORGANIZATION DETAILS */}
        {/* ==================================================== */}
        {currentStep === 1 && (
          <div className="space-y-5">
            {existingOrganization && (
              <div className="p-3.5 rounded-xl bg-[#eaf2ed]/80 border border-[#d0e2d5] flex items-center justify-between text-xs text-stone-800 shadow-2xs mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2d523e]" />
                  <span>
                    Using registered organization: <strong>{existingOrganization.name}</strong> ({existingOrganization.industry || 'Saved'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-[#2d523e] text-white hover:bg-[#234232] transition-colors"
                >
                  <span>Continue to Website</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#2d523e]" />
                <span>Step 1: Organization & Business Identity</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Provide details about your business entity acting as the Data Fiduciary.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-stone-700 font-semibold block mb-1">
                  Business / Organization Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Financial Services Pvt Ltd"
                  value={orgData.name}
                  onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2d523e] ${
                    errors.name ? 'border-rose-400 bg-rose-50/30' : 'border-stone-200'
                  }`}
                />
                {errors.name && <p className="text-rose-600 text-[11px] mt-1">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-stone-700 font-semibold block mb-1">Organization Type</label>
                  <select
                    value={orgData.organizationType}
                    onChange={(e) => setOrgData({ ...orgData, organizationType: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-stone-200 text-stone-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                  >
                    <option value="Private Limited Company">Private Limited Company</option>
                    <option value="Public Limited Company">Public Limited Company</option>
                    <option value="Limited Liability Partnership (LLP)">Limited Liability Partnership (LLP)</option>
                    <option value="Sole Proprietorship / Partnership">Sole Proprietorship / Partnership</option>
                    <option value="Non-Profit / Section 8">Non-Profit / Section 8</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-stone-700 font-semibold block mb-1">Industry Sector</label>
                  <select
                    value={orgData.industry}
                    onChange={(e) => setOrgData({ ...orgData, industry: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-stone-200 text-stone-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                  >
                    <option value="Fintech / Banking">Fintech / Banking</option>
                    <option value="Healthcare / HealthTech">Healthcare / HealthTech</option>
                    <option value="E-commerce & Retail">E-commerce & Retail</option>
                    <option value="SaaS & Cloud Services">SaaS & Cloud Services</option>
                    <option value="EdTech">EdTech</option>
                    <option value="Media & Entertainment">Media & Entertainment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-stone-700 font-semibold block mb-1">
                    Contact Person Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Priya Sharma"
                    value={orgData.contactPerson}
                    onChange={(e) => setOrgData({ ...orgData, contactPerson: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2d523e] ${
                      errors.contactPerson ? 'border-rose-400 bg-rose-50/30' : 'border-stone-200'
                    }`}
                  />
                  {errors.contactPerson && <p className="text-rose-600 text-[11px] mt-1">{errors.contactPerson}</p>}
                </div>

                <div>
                  <label className="text-stone-700 font-semibold block mb-1">
                    Business Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="priya@acme.com"
                    value={orgData.contactEmail}
                    onChange={(e) => setOrgData({ ...orgData, contactEmail: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2d523e] ${
                      errors.contactEmail ? 'border-rose-400 bg-rose-50/30' : 'border-stone-200'
                    }`}
                  />
                  {errors.contactEmail && <p className="text-rose-600 text-[11px] mt-1">{errors.contactEmail}</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 2: WEBSITE & PROCESSING */}
        {/* ==================================================== */}
        {currentStep === 2 && (
          <div className="space-y-5">
            {existingOrganization && (
              <div className="p-3.5 rounded-xl bg-[#eaf2ed]/80 border border-[#d0e2d5] flex items-center justify-between text-xs text-stone-800 shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#2d523e] text-white flex items-center justify-center font-bold text-xs">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900">{existingOrganization.name}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white text-[#2d523e] border border-[#d0e2d5]">
                        {existingOrganization.industry || 'Saved Organization'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      Organization details loaded. Configure your website and assessment scope below.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#2d523e] hover:bg-white/80 border border-[#2d523e]/20 transition-all"
                >
                  Edit Organization Info
                </button>
              </div>
            )}

            <div className="border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#2d523e]" />
                <span>Step 2: Website Details & Processing Capabilities</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Tell us which website to assess and what features it offers to visitors.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-stone-700 font-semibold block mb-1">
                    Website Name / Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Acme Customer Portal"
                    value={webData.websiteName}
                    onChange={(e) => setWebData({ ...webData, websiteName: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2d523e] ${
                      errors.websiteName ? 'border-rose-400 bg-rose-50/30' : 'border-stone-200'
                    }`}
                  />
                  {errors.websiteName && <p className="text-rose-600 text-[11px] mt-1">{errors.websiteName}</p>}
                </div>

                <div>
                  <label className="text-stone-700 font-semibold block mb-1">
                    Full Website URL <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://acme.com or http://127.0.0.1:4005"
                    value={webData.websiteUrl}
                    onChange={(e) => setWebData({ ...webData, websiteUrl: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2d523e] ${
                      errors.websiteUrl ? 'border-rose-400 bg-rose-50/30' : 'border-stone-200'
                    }`}
                  />
                  {errors.websiteUrl && <p className="text-rose-600 text-[11px] mt-1">{errors.websiteUrl}</p>}
                </div>
              </div>

              <div>
                <label className="text-stone-700 font-semibold block mb-1">
                  Website Purpose <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Online customer portal for retail account management and loan inquiries"
                  value={webData.websitePurpose}
                  onChange={(e) => setWebData({ ...webData, websitePurpose: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2d523e] ${
                    errors.websitePurpose ? 'border-rose-400 bg-rose-50/30' : 'border-stone-200'
                  }`}
                />
                {errors.websitePurpose && <p className="text-rose-600 text-[11px] mt-1">{errors.websitePurpose}</p>}
              </div>

              {/* Active Website Features Checkboxes */}
              <div className="pt-2">
                <span className="font-semibold text-stone-800 block mb-2">
                  Active Website Features (Check all that apply)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { key: 'cookies_analytics', label: 'Cookie banner & analytics tracking' },
                    { key: 'contact_forms', label: 'Inquiry or contact forms' },
                    { key: 'registration_login', label: 'User account creation & login' },
                    { key: 'newsletter_marketing', label: 'Email newsletter subscriptions' },
                    { key: 'user_profiles', label: 'User profiles / personal dashboards' },
                    { key: 'account_deletion_data_request', label: 'Self-service account deletion option' },
                  ].map((feat) => (
                    <label
                      key={feat.key}
                      className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        webData.features[feat.key]
                          ? 'border-[#2d523e] bg-[#eaf2ed]/40 text-stone-900'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={webData.features[feat.key]}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setWebData({
                            ...webData,
                            features: { ...webData.features, [feat.key]: isChecked },
                          });
                          if (feat.key === 'registration_login') {
                            if (isChecked) {
                              setAuthTesting((prev) => ({
                                ...prev,
                                skipAuthenticatedTesting: false,
                                loginUrl: prev.loginUrl || (webData.websiteUrl ? `${webData.websiteUrl.replace(/\/$/, '')}/login` : '/login'),
                              }));
                            } else {
                              setAuthTesting((prev) => ({
                                ...prev,
                                skipAuthenticatedTesting: true,
                              }));
                            }
                          }
                        }}
                        className="rounded border-stone-300 text-[#2d523e] focus:ring-[#2d523e] mt-0.5"
                      />
                      <span className="text-xs">{feat.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* ==================================================== */}
              {/* CONDITIONAL TEST ACCOUNT CREDENTIALS (OPTIONAL)      */}
              {/* ==================================================== */}
              {webData.features.registration_login && (
                <div
                  id="conditional-login-credentials-section"
                  className="mt-4 p-5 rounded-2xl bg-[#fafaf9] border border-stone-200/90 shadow-2xs space-y-4 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-stone-200/70 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-[#eaf2ed] text-[#2d523e]">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-stone-900">
                          Test Account Credentials (Optional)
                        </h3>
                        <p className="text-[11px] text-stone-500">
                          Configure automated inspection of authenticated pages, or choose public pages only.
                        </p>
                      </div>
                    </div>

                    {/* Quick Skip / Scope Indicator */}
                    <button
                      type="button"
                      onClick={() =>
                        setAuthTesting((prev) => ({
                          ...prev,
                          skipAuthenticatedTesting: !prev.skipAuthenticatedTesting,
                        }))
                      }
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                        authTesting.skipAuthenticatedTesting
                          ? 'bg-[#2d523e]/10 text-[#2d523e] border-[#2d523e]/30'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {authTesting.skipAuthenticatedTesting
                        ? '✓ Testing Public Pages Only'
                        : 'Switch to Public Pages Only'}
                    </button>
                  </div>

                  {/* Mode Selector Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        authTesting.skipAuthenticatedTesting
                          ? 'border-[#2d523e] bg-[#eaf2ed]/40 text-stone-900'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="authScopeMode"
                          checked={authTesting.skipAuthenticatedTesting}
                          onChange={() =>
                            setAuthTesting((prev) => ({ ...prev, skipAuthenticatedTesting: true }))
                          }
                          className="mt-0.5 text-[#2d523e] focus:ring-[#2d523e]"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-xs block text-stone-900">
                            Public Pages Only (Recommended)
                          </span>
                          <p className="text-[11px] text-stone-500 leading-relaxed">
                            Assess public notices, cookie banners, and registration forms. No login credentials required.
                          </p>
                        </div>
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        !authTesting.skipAuthenticatedTesting
                          ? 'border-[#2d523e] bg-[#eaf2ed]/40 text-stone-900'
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="authScopeMode"
                          checked={!authTesting.skipAuthenticatedTesting}
                          onChange={() =>
                            setAuthTesting((prev) => ({
                              ...prev,
                              skipAuthenticatedTesting: false,
                              loginUrl: prev.loginUrl || (webData.websiteUrl ? `${webData.websiteUrl.replace(/\/$/, '')}/login` : '/login'),
                            }))
                          }
                          className="mt-0.5 text-[#2d523e] focus:ring-[#2d523e]"
                        />
                        <div className="space-y-0.5">
                          <span className="font-semibold text-xs block text-stone-900">
                            Provide Test Account Credentials
                          </span>
                          <p className="text-[11px] text-stone-500 leading-relaxed">
                            Automate login to inspect user dashboards, profile settings, and data access/deletion flows.
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* If user enabled authenticated credentials */}
                  {!authTesting.skipAuthenticatedTesting && (
                    <div className="space-y-4 pt-1">
                      {/* Authentication Method Selector */}
                      <div>
                        <label className="text-stone-700 font-semibold block mb-1">
                          Authentication Method Used by Website
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label
                            className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                              authTesting.method === 'password'
                                ? 'border-[#2d523e] bg-white text-stone-900 font-semibold shadow-2xs'
                                : 'border-stone-200 bg-white/70 text-stone-600 hover:bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="authMethod"
                              value="password"
                              checked={authTesting.method === 'password'}
                              onChange={() => setAuthTesting((prev) => ({ ...prev, method: 'password' }))}
                              className="text-[#2d523e] focus:ring-[#2d523e]"
                            />
                            <span className="text-xs">Email / Username and Password</span>
                          </label>

                          <label
                            className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${
                              authTesting.method === 'sso_mfa_other'
                                ? 'border-[#2d523e] bg-white text-stone-900 font-semibold shadow-2xs'
                                : 'border-stone-200 bg-white/70 text-stone-600 hover:bg-white'
                            }`}
                          >
                            <input
                              type="radio"
                              name="authMethod"
                              value="sso_mfa_other"
                              checked={authTesting.method === 'sso_mfa_other'}
                              onChange={() => setAuthTesting((prev) => ({ ...prev, method: 'sso_mfa_other' }))}
                              className="text-[#2d523e] focus:ring-[#2d523e]"
                            />
                            <span className="text-xs">Other (SSO, OTP, CAPTCHA, MFA)</span>
                          </label>
                        </div>
                      </div>

                      {/* Unsupported / Complex Method Explanatory Callout */}
                      {authTesting.method === 'sso_mfa_other' && (
                        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-semibold text-xs text-amber-800">
                            <Info className="w-3.5 h-3.5" />
                            <span>Manual Intervention & Security Policy Notice</span>
                          </div>
                          <p className="text-[11px] leading-relaxed text-amber-800/90">
                            Websites protected by Single Sign-On (SSO), SMS/Email OTP, CAPTCHA, or hardware MFA require manual intervention or additional configuration. DPDP Vault strictly respects website authorization boundaries and never attempts to bypass authentication or security controls. Automated testing will assess public pages, and will pause for manual assistance if challenge screens are met.
                          </p>
                        </div>
                      )}

                      {/* Password Credentials Fields */}
                      {authTesting.method === 'password' && (
                        <div className="space-y-3 bg-white p-4 rounded-xl border border-stone-200">
                          {/* Login URL */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-stone-700 font-semibold">
                                Login Page URL <span className="text-rose-500">*</span>
                              </label>
                              {webData.websiteUrl && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAuthTesting((prev) => ({
                                      ...prev,
                                      loginUrl: `${webData.websiteUrl.replace(/\/$/, '')}/login`,
                                    }))
                                  }
                                  className="text-[10px] text-[#2d523e] hover:underline"
                                >
                                  Use default: /login
                                </button>
                              )}
                            </div>
                            <input
                              type="text"
                              placeholder="e.g. /login or http://127.0.0.1:4005/login"
                              value={authTesting.loginUrl}
                              onChange={(e) => setAuthTesting((prev) => ({ ...prev, loginUrl: e.target.value }))}
                              className={`w-full p-2.5 rounded-xl border text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2d523e] ${
                                errors.loginUrl ? 'border-rose-400 bg-rose-50/30' : 'border-stone-200'
                              }`}
                            />
                            {errors.loginUrl ? (
                              <p className="text-rose-600 text-[11px] mt-1">{errors.loginUrl}</p>
                            ) : (
                              <p className="text-stone-400 text-[11px] mt-1">
                                Must be a relative path or belong to the approved domain ({webData.websiteUrl || 'target website'}).
                              </p>
                            )}
                          </div>

                          {/* Username & Password Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-stone-700 font-semibold block mb-1">
                                Test Account Username / Email <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                placeholder="test_auditor@acme.com"
                                value={authTesting.username}
                                onChange={(e) => setAuthTesting((prev) => ({ ...prev, username: e.target.value }))}
                                className={`w-full p-2.5 rounded-xl border text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2d523e] ${
                                  errors.loginUsername ? 'border-rose-400 bg-rose-50/30' : 'border-stone-200'
                                }`}
                              />
                              {errors.loginUsername && (
                                <p className="text-rose-600 text-[11px] mt-1">{errors.loginUsername}</p>
                              )}
                            </div>

                            <div>
                              <label className="text-stone-700 font-semibold block mb-1">
                                Test Account Password <span className="text-rose-500">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type={authTesting.showPassword ? 'text' : 'password'}
                                  placeholder="Dedicated test account password"
                                  value={authTesting.password}
                                  onChange={(e) => setAuthTesting((prev) => ({ ...prev, password: e.target.value }))}
                                  className={`w-full p-2.5 pr-10 rounded-xl border text-stone-900 bg-white placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-[#2d523e] ${
                                    errors.loginPassword ? 'border-rose-400 bg-rose-50/30' : 'border-stone-200'
                                  }`}
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAuthTesting((prev) => ({ ...prev, showPassword: !prev.showPassword }))
                                  }
                                  aria-label={authTesting.showPassword ? 'Hide password' : 'Show password'}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700 focus:outline-none"
                                >
                                  {authTesting.showPassword ? (
                                    <EyeOff className="w-4 h-4" />
                                  ) : (
                                    <Eye className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                              {errors.loginPassword && (
                                <p className="text-rose-600 text-[11px] mt-1">{errors.loginPassword}</p>
                              )}
                            </div>
                          </div>

                          {/* Security Notice */}
                          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/90 text-stone-600 space-y-1">
                            <span className="font-semibold text-stone-800 text-[11px] block">
                              🔒 Dedicated Test Credentials Required
                            </span>
                            <p className="text-[11px] leading-relaxed">
                              Please supply a dedicated, non-sensitive test account with strictly limited permissions. Do not provide personal or production administrator credentials. Test passwords are encrypted in transit, never stored in browser storage, logs, or AI model prompts, and are immediately cleared after session verification.
                            </p>
                          </div>

                          {/* Confirmation Checkbox */}
                          <label className="flex items-start gap-2.5 p-2 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={authTesting.authorizedConfirmation}
                              onChange={(e) =>
                                setAuthTesting((prev) => ({ ...prev, authorizedConfirmation: e.target.checked }))
                              }
                              className="rounded border-stone-300 text-[#2d523e] focus:ring-[#2d523e] mt-0.5"
                            />
                            <span className="text-[11px] text-stone-700">
                              I confirm that these are dedicated test credentials authorized for automated DPDP assessment testing on this website. <span className="text-rose-500">*</span>
                            </span>
                          </label>
                          {errors.loginAuthorized && (
                            <p className="text-rose-600 text-[11px]">{errors.loginAuthorized}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 3: PRIVACY DOCUMENTS */}
        {/* ==================================================== */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#2d523e]" />
                <span>Step 3: Privacy Documents (Optional)</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Upload existing Privacy Policies or consent notices for automated document review.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* File Upload Drop Zone */}
              <div className="p-6 rounded-2xl border-2 border-dashed border-stone-200 bg-[#fafaf9] text-center space-y-2 hover:border-[#2d523e]/50 transition-colors">
                <Upload className="w-6 h-6 text-stone-400 mx-auto" />
                <div>
                  <label className="font-semibold text-[#2d523e] hover:underline cursor-pointer">
                    Click to browse files
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-stone-400 text-[11px] mt-0.5">
                    Supports PDF, DOCX, and TXT files up to 10MB each
                  </p>
                </div>
              </div>

              {/* Uploaded Files List */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <span className="font-semibold text-stone-700 block">Uploaded Files ({uploadedFiles.length})</span>
                  {uploadedFiles.map((f) => (
                    <div
                      key={f._id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200"
                    >
                      <div className="flex items-center gap-2 text-stone-800">
                        <FileCheck className="w-4 h-4 text-[#2d523e]" />
                        <span className="font-medium truncate max-w-xs">{f.title || f.originalFileName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(f._id)}
                        className="text-stone-400 hover:text-rose-600 p-1 rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-[#eaf2ed]/40 border border-[#d0e2d5] text-stone-700 space-y-1">
                <span className="font-semibold text-[#2d523e] block">Don&apos;t have document files?</span>
                <p className="text-[11px] text-stone-600">
                  That&apos;s completely fine! Our automated inspector will crawl your website&apos;s published Privacy Policy and Terms links directly. You can proceed to the next step.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 4: AUTHORIZED TESTING SCOPE */}
        {/* ==================================================== */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2d523e]" />
                <span>Step 4: Authorized Testing Scope</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Verify authorization and configure the safe boundaries for automated testing.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Mandatory Ownership Confirmation */}
              <div
                className={`p-4 rounded-xl border transition-all ${
                  scopeData.authorized
                    ? 'border-[#2d523e] bg-[#eaf2ed]/30'
                    : 'border-stone-200 bg-stone-50'
                }`}
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scopeData.authorized}
                    onChange={(e) => setScopeData({ ...scopeData, authorized: e.target.checked })}
                    className="rounded border-stone-300 text-[#2d523e] focus:ring-[#2d523e] mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-stone-900 text-xs block">
                      I confirm domain ownership or authorized testing consent <span className="text-rose-500">*</span>
                    </span>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      I certify that I am the owner of <strong>{webData.websiteUrl || 'the specified website'}</strong> or have been authorized by the Data Fiduciary to conduct automated privacy evaluations.
                    </p>
                  </div>
                </label>
                {errors.authorized && <p className="text-rose-600 text-[11px] mt-2 font-medium">{errors.authorized}</p>}
              </div>

              <div>
                <label className="text-stone-700 font-semibold block mb-1">
                  Permitted Page Paths
                </label>
                <input
                  type="text"
                  value={scopeData.allowedPaths}
                  onChange={(e) => setScopeData({ ...scopeData, allowedPaths: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-stone-200 text-stone-900 bg-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                />
                <span className="text-stone-400 text-[11px] mt-1 block">
                  Comma-separated list of public routes the crawler is allowed to visit.
                </span>
              </div>

              <div>
                <label className="text-stone-700 font-semibold block mb-1">
                  Excluded Sensitive Paths
                </label>
                <input
                  type="text"
                  value={scopeData.excludedPaths}
                  onChange={(e) => setScopeData({ ...scopeData, excludedPaths: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-stone-200 text-stone-900 bg-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                />
                <span className="text-stone-400 text-[11px] mt-1 block">
                  Routes that the automated inspector must strictly avoid.
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-600 space-y-1">
                <span className="font-semibold text-stone-800 block">Safe Read-Only Browsing</span>
                <p className="text-[11px] leading-relaxed">
                  Our crawler simulates standard website visitors. It does not attempt penetration testing, access restricted databases, or submit unapproved payment transactions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* STEP 5: REVIEW AND START */}
        {/* ==================================================== */}
        {currentStep === 5 && (
          <div className="space-y-5">
            <div className="border-b border-stone-100 pb-3">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2d523e]" />
                <span>Step 5: Review & Confirm Assessment</span>
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Review your configuration before launching the automated privacy assessment.
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* Summary Cards */}
              <div className="p-4 rounded-xl bg-[#fafaf9] border border-stone-200 space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400 block tracking-wider">
                  Organization & Contact
                </span>
                <div className="grid grid-cols-2 gap-2 text-stone-800">
                  <div>
                    <span className="text-stone-500">Business Name:</span> <strong>{orgData.name}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500">Industry:</span> <strong>{orgData.industry}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500">Contact Person:</span> <strong>{orgData.contactPerson}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500">Business Email:</span> <strong>{orgData.contactEmail}</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#fafaf9] border border-stone-200 space-y-2">
                <span className="text-[10px] font-bold uppercase text-stone-400 block tracking-wider">
                  Target Website & Scope
                </span>
                <div className="space-y-1 text-stone-800">
                  <div>
                    <span className="text-stone-500">Target URL:</span> <strong className="font-mono">{webData.websiteUrl}</strong>
                  </div>
                  <div>
                    <span className="text-stone-500">Purpose:</span> <span>{webData.websitePurpose}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-stone-500 block">Active Features:</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Object.entries(webData.features)
                        .filter(([_, v]) => v)
                        .map(([k]) => (
                          <span
                            key={k}
                            className="text-[10px] bg-white border border-stone-200 px-2 py-0.5 rounded text-stone-700"
                          >
                            {k.replace(/_/g, ' ')}
                          </span>
                        ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-200/80">
                    <span className="text-stone-500 block">Authentication Scope:</span>
                    <span className="font-semibold text-stone-900">
                      {!webData.features.registration_login
                        ? 'Public pages only (Account login not enabled)'
                        : authTesting.skipAuthenticatedTesting
                        ? 'Public pages only (Authenticated testing skipped by user)'
                        : authTesting.method === 'sso_mfa_other'
                        ? 'SSO / MFA / OTP (Manual intervention required)'
                        : `Automated Test Account: ${authTesting.username.slice(0, 3)}*** (URL: ${authTesting.loginUrl || '/login'})`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#eaf2ed]/40 border border-[#d0e2d5] text-stone-700 space-y-1">
                <span className="font-semibold text-[#2d523e] block">Ready to Begin</span>
                <p className="text-[11px] leading-relaxed">
                  Clicking <strong>Start Website Assessment</strong> will initialize the automated Playwright sandbox, crawl your permitted pages, analyze consent notices, and produce your compliance report.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          ) : (
            <Link
              href="/"
              className="text-xs text-stone-500 hover:text-stone-800 font-medium"
            >
              Cancel
            </Link>
          )}

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all"
            >
              <span>Continue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartAssessment}
              disabled={submitting}
              id="confirm-start-assessment-btn"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-md disabled:opacity-50 transition-all"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Initializing Assessment...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Start Website Assessment</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
