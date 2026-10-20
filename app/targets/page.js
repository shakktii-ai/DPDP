'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Plus,
  Globe,
  Lock,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  X,
  RefreshCw,
  Sliders
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';

export default function TargetsPage() {
  const [targets, setTargets] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    organizationId: '',
    targetUrl: '',
    approvedScope: [
      'public_pages',
      'cookie_consent_banners',
      'tracking_scripts',
      'privacy_policy'
    ],
    excludedPaths: '/admin, /internal, /api/private',
    authorizationConfirmed: true,
    confirmedByName: '',
    confirmedByDesignation: 'Compliance Officer'
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [targetRes, orgRes] = await Promise.all([
        fetch('/api/targets'),
        fetch('/api/organizations')
      ]);
      const targetJson = await targetRes.json();
      const orgJson = await orgRes.json();

      if (targetJson.success) setTargets(targetJson.data || []);
      if (orgJson.success) {
        setOrganizations(orgJson.data || []);
        if (orgJson.data?.length > 0 && !formData.organizationId) {
          setFormData((p) => ({ ...p, organizationId: orgJson.data[0]._id }));
        }
      }
    } catch (e) {
      console.error('Failed to load targets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.organizationId) {
      setError('Please select an organization.');
      return;
    }
    if (!formData.targetUrl) {
      setError('Please enter target URL.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: formData.organizationId,
          targetUrl: formData.targetUrl,
          approvedScope: formData.approvedScope,
          excludedPaths: formData.excludedPaths.split(',').map((p) => p.trim()).filter(Boolean),
          authorizationConfirmation: {
            confirmed: formData.authorizationConfirmed,
            confirmedByName: formData.confirmedByName || 'Authorized Representative',
            confirmedByDesignation: formData.confirmedByDesignation
          }
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add approved target');
      }

      setSuccess(`Domain '${data.data.approvedDomain}' approved successfully for assessment.`);
      setShowModal(false);
      setFormData((p) => ({
        ...p,
        targetUrl: '',
        confirmedByName: ''
      }));
      loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#2d523e]" />
            <span>Authorized Assessment Targets</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Registered domains with affirmative legal authorization and active SSRF mitigation checks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 shadow-xs"
            title="Refresh Targets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setError('');
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Approved Target</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Target List or Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-44 bg-slate-100 border border-slate-200 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : targets.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No Approved Targets Configured"
          description="Under DPDP Act statutory requirements, website testing is strictly restricted to verified, approved targets. Add your first authorized domain."
          primaryActionText="Add Approved Target"
          primaryActionHref="#"
          secondaryActionText="Run Onboarding Wizard"
          secondaryActionHref="/onboarding"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {targets.map((target) => (
            <div
              key={target._id}
              className="p-6 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#eaf2ed] border border-[#d0e2d5] text-[#2d523e] flex items-center justify-center font-bold">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-tight font-mono">
                      {target.approvedDomain}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {target.organization?.name || 'Organization'}
                    </p>
                  </div>
                </div>
                <StatusBadge status={target.targetStatus} />
              </div>

              {/* Target URL & SSRF status */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Target Base URL</span>
                  <a
                    href={target.targetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#2d523e] hover:underline flex items-center gap-1 font-mono font-medium"
                  >
                    <span>{target.targetUrl}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>SSRF Security Inspection</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Passed (Verified External)
                  </span>
                </div>
              </div>

              {/* Approved Scope & Excluded Paths */}
              <div className="space-y-1 text-xs">
                <span className="text-slate-600 block font-medium">Permitted Scope:</span>
                <div className="flex flex-wrap gap-1.5">
                  {target.approvedScope?.map((s, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      {s.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {target.excludedPaths?.length > 0 && (
                <div className="text-xs text-slate-600">
                  <span className="font-medium text-slate-600">Excluded: </span>
                  <span className="font-mono text-slate-800 text-[11px]">
                    {target.excludedPaths.join(', ')}
                  </span>
                </div>
              )}

              {/* Action row */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  Authorized: {new Date(target.approvalTimestamp).toLocaleDateString()}
                </span>
                <Link
                  href={`/assessments/new?targetUrl=${encodeURIComponent(target.targetUrl)}&orgId=${target.organization?._id || target.organization}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2d523e] hover:text-emerald-900"
                >
                  <span>Launch Assessment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Approved Target Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#2d523e]" />
                  <span>Authorize New Target Domain</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  SSRF validation and statutory confirmation required prior to assessment.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Data Fiduciary Organization *
                </label>
                <select
                  value={formData.organizationId}
                  onChange={(e) => setFormData((p) => ({ ...p, organizationId: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-emerald-600 focus:outline-none shadow-xs"
                >
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name} ({org.industry})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Target Website URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://example.com"
                  value={formData.targetUrl}
                  onChange={(e) => setFormData((p) => ({ ...p, targetUrl: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-xs focus:border-emerald-600 focus:outline-none shadow-xs"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Localhost, 127.0.0.1, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, and cloud metadata endpoints are strictly blocked.
                </p>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Excluded Paths (Comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="/admin, /checkout, /internal-api"
                  value={formData.excludedPaths}
                  onChange={(e) => setFormData((p) => ({ ...p, excludedPaths: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-xs focus:border-emerald-600 focus:outline-none shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Confirmed By Name
                  </label>
                  <input
                    type="text"
                    placeholder="Representative Name"
                    value={formData.confirmedByName}
                    onChange={(e) => setFormData((p) => ({ ...p, confirmedByName: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs shadow-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Designation
                  </label>
                  <input
                    type="text"
                    value={formData.confirmedByDesignation}
                    onChange={(e) => setFormData((p) => ({ ...p, confirmedByDesignation: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs shadow-xs"
                  />
                </div>
              </div>

              {/* Warranty Affirmation */}
              <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.authorizationConfirmed}
                    onChange={(e) => setFormData((p) => ({ ...p, authorizationConfirmed: e.target.checked }))}
                    className="mt-0.5 rounded border-slate-300 text-[#2d523e]"
                  />
                  <span className="text-[11px] text-slate-700 leading-tight">
                    I confirm our organization has legal authority to audit this domain for DPDP Act compliance.
                  </span>
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all disabled:opacity-50"
                >
                  {submitting ? 'Verifying & Saving...' : 'Confirm Authorization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
