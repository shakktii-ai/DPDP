'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert,
  Sparkles,
  Building2,
  Globe,
  CheckSquare,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Info,
  Lock,
  Plus
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

function NewAssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedOrgId = searchParams.get('orgId') || '';
  const preselectedUrl = searchParams.get('targetUrl') || '';

  const [organizations, setOrganizations] = useState([]);
  const [approvedTargets, setApprovedTargets] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [modelStatus, setModelStatus] = useState(null);
  const [verifyingModel, setVerifyingModel] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    organizationId: preselectedOrgId,
    targetUrl: preselectedUrl,
    websiteName: '',
    testMode: 'hybrid',
    modelUsed: 'gemini-3.8-flash',
    authorizationConfirmed: false,
    notes: '',
    scopeChecklist: {
      sec6NoticeConsent: true,
      sec7LegitimateUse: true,
      sec8FiduciaryObligations: true,
      sec9ChildProtection: true,
      trackerInspection: true
    }
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch registered organizations
  useEffect(() => {
    async function fetchOrgs() {
      try {
        setLoadingOrgs(true);
        const res = await fetch('/api/organizations');
        const json = await res.json();
        if (json.success) {
          setOrganizations(json.data || []);
          if (!formData.organizationId && json.data?.length > 0) {
            setFormData((prev) => ({
              ...prev,
              organizationId: json.data[0]._id
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load organizations:', err);
      } finally {
        setLoadingOrgs(false);
      }
    }
    fetchOrgs();
  }, [preselectedOrgId]);

  // Load Approved Targets whenever organizationId changes
  useEffect(() => {
    async function fetchTargets() {
      if (!formData.organizationId) return;
      try {
        setLoadingTargets(true);
        const res = await fetch(`/api/targets?organizationId=${formData.organizationId}`);
        const json = await res.json();
        if (json.success) {
          setApprovedTargets(json.data || []);
          if (!formData.targetUrl && json.data?.length > 0) {
            setFormData((p) => ({
              ...p,
              targetUrl: json.data[0].targetUrl,
              websiteName: `${json.data[0].approvedDomain} Portal`
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load approved targets:', err);
      } finally {
        setLoadingTargets(false);
      }
    }
    fetchTargets();
  }, [formData.organizationId]);

  // Dynamically verify Gemini model availability
  const checkModelCapabilities = async (modelName = formData.modelUsed) => {
    try {
      setVerifyingModel(true);
      const res = await fetch(`/api/gemini/verify?model=${encodeURIComponent(modelName)}`);
      const json = await res.json();
      if (json.success) {
        setModelStatus(json.capabilities);
        if (json.capabilities.activeModel) {
          setFormData((prev) => ({ ...prev, modelUsed: json.capabilities.activeModel }));
        }
      }
    } catch (e) {
      console.error('Failed to verify model:', e);
    } finally {
      setVerifyingModel(false);
    }
  };

  useEffect(() => {
    checkModelCapabilities();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleOrgChange = (e) => {
    const orgId = e.target.value;
    setFormData((prev) => ({
      ...prev,
      organizationId: orgId,
      targetUrl: ''
    }));
  };

  const handleTargetSelection = (target) => {
    setFormData((p) => ({
      ...p,
      targetUrl: target.targetUrl,
      websiteName: `${target.approvedDomain} Portal`
    }));
  };

  // Check if current target URL is within approved targets
  const getDomainFromUrl = (url) => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  };

  const currentDomain = getDomainFromUrl(formData.targetUrl);
  const matchingApprovedTarget = approvedTargets.find(
    (t) => t.approvedDomain === currentDomain && t.targetStatus === 'approved'
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.organizationId) {
      setError('Please select an organization.');
      return;
    }
    if (!formData.targetUrl || !formData.targetUrl.startsWith('http')) {
      setError('Please enter a valid website URL beginning with http:// or https://');
      return;
    }
    if (!matchingApprovedTarget) {
      setError(
        `Domain '${currentDomain || formData.targetUrl}' is not in the Approved Targets registry. Only approved targets can be assessed.`
      );
      return;
    }
    if (!formData.authorizationConfirmed) {
      setError('You must confirm testing authorization under DPDP compliance guidelines.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to queue assessment');
      }

      router.push(`/testing?id=${data.data._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Launch New DPDP Website Assessment
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure test parameters, AI inspection model, and authorized assessment scope.
          </p>
        </div>
        <Link
          href="/onboarding"
          className="text-xs text-[#2d523e] hover:text-emerald-900 font-semibold inline-flex items-center gap-1"
        >
          <span>Run Onboarding Wizard</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Model Verification Banner */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-semibold text-slate-900">
              AI Inspection Engine Verification
            </span>
          </div>
          <button
            type="button"
            onClick={() => checkModelCapabilities(formData.modelUsed)}
            disabled={verifyingModel}
            className="text-[11px] text-[#2d523e] hover:underline inline-flex items-center gap-1 font-medium"
          >
            <RefreshCw className={`w-3 h-3 ${verifyingModel ? 'animate-spin' : ''}`} />
            <span>Verify Model</span>
          </button>
        </div>

        <div className="text-xs text-slate-600 leading-relaxed">
          {modelStatus?.isConfigured ? (
            <div className="flex items-center gap-2 text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              <span>
                Active Model: <strong className="font-mono">{modelStatus.activeModel}</strong> &bull;{' '}
                {modelStatus.isProposedAvailable
                  ? 'Proposed model verified in project.'
                  : 'Operating via verified fallback model.'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-800">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              <span>
                Proposed Model: <strong className="font-mono">gemini-3.8-flash</strong> (Fallback resolution enabled).
              </span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Organization Selection */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#2d523e]" />
            <span>1. Organization & Approved Target Domain</span>
          </h3>

          {loadingOrgs ? (
            <div className="h-10 bg-slate-100 animate-pulse rounded-lg" />
          ) : organizations.length === 0 ? (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
              <span>No organizations registered yet. Please onboard your entity first.</span>
              <Link
                href="/onboarding"
                className="font-bold underline text-amber-900"
              >
                Start Onboarding
              </Link>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Data Fiduciary Organization *
              </label>
              <select
                name="organizationId"
                value={formData.organizationId}
                onChange={handleOrgChange}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:border-emerald-600 focus:outline-none shadow-xs"
              >
                {organizations.map((org) => (
                  <option key={org._id} value={org._id}>
                    {org.name} ({org.industry})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Approved Targets for Selected Organization */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Select from Approved Targets *
              </label>
              <Link
                href="/targets"
                className="text-[11px] text-[#2d523e] hover:underline flex items-center gap-1 font-semibold"
              >
                <Plus className="w-3 h-3" />
                <span>Add Target Domain</span>
              </Link>
            </div>

            {loadingTargets ? (
              <div className="h-10 bg-slate-100 animate-pulse rounded-lg" />
            ) : approvedTargets.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {approvedTargets.map((target) => {
                  const isSelected = formData.targetUrl === target.targetUrl;
                  return (
                    <div
                      key={target._id}
                      onClick={() => handleTargetSelection(target)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#eaf2ed] border-[#2d523e] text-slate-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <span className="font-mono font-bold text-xs block text-slate-900">
                          {target.approvedDomain}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono truncate block max-w-[200px]">
                          {target.targetUrl}
                        </span>
                      </div>
                      <StatusBadge status={target.targetStatus} size="xs" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                <span>No approved targets found for this organization.</span>
                <Link
                  href="/targets"
                  className="font-bold underline text-amber-900"
                >
                  Authorize Domain
                </Link>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Website URL *
              </label>
              <input
                type="url"
                name="targetUrl"
                required
                value={formData.targetUrl}
                onChange={handleChange}
                placeholder="https://example.com"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-mono focus:border-emerald-600 focus:outline-none shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Website Name / Label
              </label>
              <input
                type="text"
                name="websiteName"
                value={formData.websiteName}
                onChange={handleChange}
                placeholder="e.g. Main Public Portal"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-emerald-600 focus:outline-none shadow-xs"
              />
            </div>
          </div>

          {/* Approved Target Validation State */}
          {formData.targetUrl && (
            <div className="pt-1">
              {matchingApprovedTarget ? (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>
                    Domain <strong>{currentDomain}</strong> is an Approved Target with valid authorization.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>
                      Domain <strong>{currentDomain || 'unspecified'}</strong> is not in your Approved Targets list.
                    </span>
                  </div>
                  <Link
                    href="/targets"
                    className="font-bold underline text-rose-900"
                  >
                    Approve Target Now
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audit Mode & Model Configuration */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-700" />
            <span>2. Assessment Mode & Model Parameters</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Audit Execution Mode
              </label>
              <select
                name="testMode"
                value={formData.testMode}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-emerald-600 focus:outline-none shadow-xs"
              >
                <option value="hybrid">Hybrid (DOM Inspection + Vision Analysis)</option>
                <option value="automated_vision">Automated Vision (Computer Use Mode)</option>
                <option value="dom_inspect">DOM & Script Inspector (Lightweight)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Gemini Model Requested
              </label>
              <input
                type="text"
                name="modelUsed"
                value={formData.modelUsed}
                onChange={handleChange}
                placeholder="gemini-3.8-flash"
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-mono focus:border-emerald-600 focus:outline-none shadow-xs"
              />
            </div>
          </div>
        </div>

        {/* DPDP Legal Scope Checklist */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#2d523e]" />
            <span>3. Statutory DPDP Act 2023 Assessment Scope</span>
          </h3>

          <div className="space-y-2 text-xs text-slate-700">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
              <CheckSquare className="w-4 h-4 text-[#2d523e]" />
              <span>Section 6: Notice & Consent itemization, multilingual support, and affirmative consent test.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
              <CheckSquare className="w-4 h-4 text-[#2d523e]" />
              <span>Section 7: Legitimate uses, withdrawal of consent mechanisms, unbundled agreements.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
              <CheckSquare className="w-4 h-4 text-[#2d523e]" />
              <span>Section 8: Data Fiduciary identification & Grievance Redressal Officer publication.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
              <CheckSquare className="w-4 h-4 text-[#2d523e]" />
              <span>Section 9: Children data protection safeguards & age gate inspection.</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
              <CheckSquare className="w-4 h-4 text-[#2d523e]" />
              <span>Network Inspector: Pre-consent adtech tracking beacons & third-party cookie telemetry.</span>
            </div>
          </div>
        </div>

        {/* Statutory Authorization Affirmation */}
        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="authorizationConfirmed"
              checked={formData.authorizationConfirmed}
              onChange={handleChange}
              className="mt-1 rounded border-slate-300 text-[#2d523e] focus:ring-[#2d523e]"
            />
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong className="text-slate-900 block font-semibold mb-0.5">
                Statutory Assessment Authorization
              </strong>
              I confirm that our organization has proper legal authorization to test, crawl, and audit the privacy implementations of the specified target domain.
            </div>
          </label>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/assessments"
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-all border border-slate-200"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || organizations.length === 0 || !matchingApprovedTarget}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all disabled:opacity-50"
          >
            {submitting ? (
              <span>Queueing Assessment...</span>
            ) : (
              <>
                <span>Initialize Assessment</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewAssessmentPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-500">
          <div className="w-8 h-8 mx-auto border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs">Loading assessment configuration...</p>
        </div>
      }
    >
      <NewAssessmentContent />
    </Suspense>
  );
}
