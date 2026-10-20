'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Globe,
  Shield,
  Lock,
  Mail,
  Phone,
  MapPin,
  Save,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Plus,
  ExternalLink,
  FileText
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

export default function OrganizationDetailPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;

  const [org, setOrg] = useState(null);
  const [targets, setTargets] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadOrg = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/organizations/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load organization details');
      }
      setOrg(json.data.organization);
      setTargets(json.data.targets || []);
      setDocuments(json.data.documents || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadOrg();
  }, [id]);

  const handleChange = (field, value) => {
    setOrg((prev) => ({ ...prev, [field]: value }));
  };

  const handleNestedChange = (parent, field, value) => {
    setOrg((prev) => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const res = await fetch(`/api/organizations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(org)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save changes');
      }
      setSuccess('Organization profile updated successfully.');
      setOrg(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <div className="h-8 w-40 bg-slate-200 animate-pulse rounded" />
        <div className="h-64 bg-white border border-slate-200 animate-pulse rounded-xl" />
      </div>
    );
  }

  if (error && !org) {
    return (
      <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm max-w-2xl mx-auto space-y-3">
        <div className="flex items-center gap-2 font-bold text-rose-900">
          <AlertTriangle className="w-5 h-5 text-rose-600" />
          <span>Error Loading Organization</span>
        </div>
        <p>{error}</p>
        <Link
          href="/organizations"
          className="inline-flex items-center gap-1 text-xs text-rose-700 underline font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Organizations</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/organizations"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Organizations</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href={`/assessments/new?orgId=${org._id}`}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234131] text-white shadow-xs transition-all"
          >
            Launch Assessment
          </Link>
        </div>
      </div>

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Profile Header */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] font-bold text-lg flex items-center justify-center">
            {org.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {org.name}
              </h2>
              <StatusBadge status={org.status} size="xs" />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {org.industry} &bull; {org.organizationType || 'Private Limited Company'}
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-500">
          <span>CIN / Registration: </span>
          <span className="font-mono text-slate-700 font-semibold">
            {org.dpdpRegistrationNumber || 'Unspecified'}
          </span>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Entity Info */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#2d523e]" />
            <span>Legal Entity Information</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-700 mb-1 font-medium">Organization Name *</label>
              <input
                type="text"
                required
                value={org.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-medium">Legal Entity Name</label>
              <input
                type="text"
                value={org.legalEntityName || ''}
                onChange={(e) => handleChange('legalEntityName', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
              />
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-medium">Entity Type</label>
              <select
                value={org.organizationType || 'Private Limited Company'}
                onChange={(e) => handleChange('organizationType', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
              >
                <option value="Private Limited Company">Private Limited Company</option>
                <option value="Public Limited Company">Public Limited Company</option>
                <option value="Limited Liability Partnership (LLP)">LLP</option>
                <option value="Sole Proprietorship / Partnership">Sole Proprietorship</option>
                <option value="Non-Profit / Section 8">Non-Profit / Section 8</option>
                <option value="Government / Public Sector">Government</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-medium">Industry</label>
              <select
                value={org.industry || 'SaaS & Cloud Services'}
                onChange={(e) => handleChange('industry', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 focus:border-[#2d523e] focus:outline-none focus:ring-1 focus:ring-[#2d523e]"
              >
                <option value="SaaS & Cloud Services">SaaS & Cloud Services</option>
                <option value="Healthcare / HealthTech">Healthcare / HealthTech</option>
                <option value="Fintech / Banking">Fintech / Banking</option>
                <option value="E-commerce & Retail">E-commerce & Retail</option>
                <option value="EdTech">EdTech</option>
                <option value="Telecommunications">Telecommunications</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </div>

        {/* DPO & Grievance Officer */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#2d523e]" />
            <span>Statutory Officers (DPDP Act Sec 8(9))</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* DPO */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-semibold text-[#2d523e] block">Data Protection Officer (DPO)</span>
              <input
                type="text"
                placeholder="DPO Name"
                value={org.dataProtectionOfficer?.name || ''}
                onChange={(e) => handleNestedChange('dataProtectionOfficer', 'name', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-900 focus:border-[#2d523e] focus:outline-none"
              />
              <input
                type="email"
                placeholder="DPO Email"
                value={org.dataProtectionOfficer?.email || ''}
                onChange={(e) => handleNestedChange('dataProtectionOfficer', 'email', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-900 focus:border-[#2d523e] focus:outline-none"
              />
              <input
                type="tel"
                placeholder="DPO Phone"
                value={org.dataProtectionOfficer?.phone || ''}
                onChange={(e) => handleNestedChange('dataProtectionOfficer', 'phone', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-900 focus:border-[#2d523e] focus:outline-none"
              />
            </div>

            {/* Grievance Officer */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-semibold text-[#2d523e] block">Grievance Redressal Officer</span>
              <input
                type="text"
                placeholder="Grievance Officer Name"
                value={org.grievanceOfficer?.name || ''}
                onChange={(e) => handleNestedChange('grievanceOfficer', 'name', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-900 focus:border-[#2d523e] focus:outline-none"
              />
              <input
                type="email"
                placeholder="Grievance Email"
                value={org.grievanceOfficer?.email || ''}
                onChange={(e) => handleNestedChange('grievanceOfficer', 'email', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-900 focus:border-[#2d523e] focus:outline-none"
              />
              <input
                type="text"
                placeholder="Physical Redressal Address"
                value={org.grievanceOfficer?.physicalAddress || ''}
                onChange={(e) => handleNestedChange('grievanceOfficer', 'physicalAddress', e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-900 focus:border-[#2d523e] focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Linked Approved Targets */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#2d523e]" />
              <span>Approved Target Domains ({targets.length})</span>
            </h3>
            <Link
              href="/targets"
              className="text-xs font-semibold text-[#2d523e] hover:text-[#1e382a] inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Manage Targets</span>
            </Link>
          </div>

          {targets.length > 0 ? (
            <div className="space-y-2 text-xs">
              {targets.map((t) => (
                <div
                  key={t._id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{t.approvedDomain}</span>
                    <span className="text-slate-500 text-[11px] font-mono">({t.targetUrl})</span>
                  </div>
                  <StatusBadge status={t.targetStatus} size="xs" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No approved targets configured for this entity.</p>
          )}
        </div>

        {/* Linked Privacy Documents */}
        <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#2d523e]" />
              <span>Ingested Privacy Documents ({documents.length})</span>
            </h3>
            <Link
              href="/documents"
              className="text-xs font-semibold text-[#2d523e] hover:text-[#1e382a] inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Document</span>
            </Link>
          </div>

          {documents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {documents.map((d) => (
                <div
                  key={d._id}
                  className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <span className="font-medium text-slate-800 truncate max-w-[200px]">{d.title}</span>
                  <span className="text-[10px] uppercase font-semibold text-slate-600 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                    {d.documentType.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">No privacy documents uploaded yet.</p>
          )}
        </div>

        {/* Save Bar */}
        <div className="pt-2 flex justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234131] text-white shadow-xs transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
