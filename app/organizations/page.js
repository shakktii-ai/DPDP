'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Globe,
  Mail,
  Phone,
  Shield,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    legalEntityName: '',
    industry: 'SaaS & Cloud Services',
    dpdpRegistrationNumber: '',
    dpoName: '',
    dpoEmail: '',
    dpoPhone: '',
    websiteName: '',
    websiteUrl: '',
    isAuthorized: true
  });

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/organizations');
      const json = await res.json();
      if (json.success) {
        setOrganizations(json.data || []);
      }
    } catch (e) {
      console.error('Failed to load organizations:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create organization');
      }

      setSuccess(`Organization "${data.data.name}" registered successfully.`);
      setShowModal(false);
      // Reset form
      setFormData({
        name: '',
        legalEntityName: '',
        industry: 'SaaS & Cloud Services',
        dpdpRegistrationNumber: '',
        dpoName: '',
        dpoEmail: '',
        dpoPhone: '',
        websiteName: '',
        websiteUrl: '',
        isAuthorized: true
      });
      loadOrganizations();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Registered Organizations & Data Fiduciaries
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage organizational entities, Data Protection Officers (DPO), and authorized domain scopes.
          </p>
        </div>

        <button
          onClick={() => {
            setError('');
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#2d523e] hover:bg-[#234131] text-white shadow-xs transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register Organization</span>
        </button>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Organizations List or Empty State */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl bg-white border border-slate-200 animate-pulse p-6"
            />
          ))}
        </div>
      ) : organizations.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No Organizations Registered"
          description="Register your legal entity and authorized website URLs to begin automated DPDP compliance assessments."
          primaryActionText="Register First Organization"
          primaryActionHref="#"
          secondaryActionText="Learn DPDP Requirements"
          secondaryActionHref="https://www.meity.gov.in/content/digital-personal-data-protection-act-2023"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {organizations.map((org) => (
            <div
              key={org._id}
              className="p-6 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all space-y-4 shadow-xs"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#eaf2ed] border border-[#d0e2d5] text-[#2d523e] flex items-center justify-center font-bold text-base">
                    {org.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base leading-tight">
                      {org.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">{org.industry}</p>
                  </div>
                </div>
                <StatusBadge status={org.status} />
              </div>

              {org.legalEntityName && (
                <div className="text-xs text-slate-600">
                  <span className="text-slate-400">Legal Entity: </span>
                  <span className="font-medium text-slate-800">{org.legalEntityName}</span>
                </div>
              )}

              {/* DPO details */}
              {org.dataProtectionOfficer?.email && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div className="text-slate-500 font-medium flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-[#2d523e]" />
                    <span>Data Protection Officer (DPO)</span>
                  </div>
                  <div className="text-slate-700 font-medium">
                    {org.dataProtectionOfficer.name || 'Assigned Officer'} &mdash;{' '}
                    <span className="text-[#2d523e]">{org.dataProtectionOfficer.email}</span>
                  </div>
                </div>
              )}

              {/* Registered Websites */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Authorized Websites ({org.registeredWebsites?.length || 0})
                </p>
                {org.registeredWebsites && org.registeredWebsites.length > 0 ? (
                  <div className="space-y-1.5">
                    {org.registeredWebsites.map((site, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Globe className="w-3.5 h-3.5 text-[#2d523e] flex-shrink-0" />
                          <span className="text-slate-800 font-medium truncate">{site.url}</span>
                        </div>
                        <StatusBadge
                          status={site.isAuthorized ? 'authorized' : 'pending_authorization'}
                          size="xs"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No websites linked yet.</p>
                )}
              </div>

              {/* Action row */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  ID: {String(org._id).slice(-8)}
                </span>
                <Link
                  href={`/assessments/new?orgId=${org._id}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2d523e] hover:text-[#1e382a]"
                >
                  <span>Launch Assessment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Register Organization Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Register Organization
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register Data Fiduciary entity for DPDP compliance tracking.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Organization Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Acme Technologies Ltd"
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
                    value={formData.legalEntityName}
                    onChange={handleChange}
                    placeholder="Acme Technologies Pvt Ltd"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Industry Sector
                  </label>
                  <select
                    name="industry"
                    value={formData.industry}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                  >
                    <option value="Fintech / Banking">Fintech / Banking</option>
                    <option value="Healthcare / HealthTech">Healthcare / HealthTech</option>
                    <option value="E-commerce & Retail">E-commerce & Retail</option>
                    <option value="SaaS & Cloud Services">SaaS & Cloud Services</option>
                    <option value="EdTech">EdTech</option>
                    <option value="Telecommunications">Telecommunications</option>
                    <option value="Government & Public Sector">Government & Public Sector</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    DPDP / CIN Registration No.
                  </label>
                  <input
                    type="text"
                    name="dpdpRegistrationNumber"
                    value={formData.dpdpRegistrationNumber}
                    onChange={handleChange}
                    placeholder="U72900MH2023PTC123456"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-sm focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                  />
                </div>
              </div>

              {/* DPO Section */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#2d523e]" />
                  <span>Data Protection Officer (DPO) Details (Sec 8(9))</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <input
                      type="text"
                      name="dpoName"
                      value={formData.dpoName}
                      onChange={handleChange}
                      placeholder="Officer Name"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      name="dpoEmail"
                      value={formData.dpoEmail}
                      onChange={handleChange}
                      placeholder="dpo@example.com"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      name="dpoPhone"
                      value={formData.dpoPhone}
                      onChange={handleChange}
                      placeholder="+91-9876543210"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                    />
                  </div>
                </div>
              </div>

              {/* Initial Website Section */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#2d523e]" />
                  <span>Primary Website Under Assessment</span>
                </p>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      name="websiteName"
                      value={formData.websiteName}
                      onChange={handleChange}
                      placeholder="Website Label e.g. Customer Portal"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                    />
                    <input
                      type="url"
                      name="websiteUrl"
                      value={formData.websiteUrl}
                      onChange={handleChange}
                      placeholder="https://example.com"
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
                    />
                  </div>

                  <label className="flex items-start gap-2.5 p-3 rounded-lg bg-[#2d523e]/5 border border-[#2d523e]/20 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isAuthorized"
                      checked={formData.isAuthorized}
                      onChange={handleChange}
                      className="mt-0.5 rounded border-slate-300 text-[#2d523e] focus:ring-[#2d523e]"
                    />
                    <span className="text-xs text-slate-700 leading-tight">
                      We explicitly authorize automated technical assessment, consent modal inspection,
                      and tracker scanning on this website in accordance with organizational policies.
                    </span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234131] text-white shadow-xs transition-all disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Save Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
