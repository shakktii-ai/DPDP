'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Globe,
  Upload,
  FileCode,
  ExternalLink,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
  Eye,
  ShieldAlert
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    organizationId: '',
    documentType: 'privacy_policy',
    title: '',
    sourceType: 'url',
    url: '',
    fileContentText: '',
    fileName: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [docRes, orgRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/organizations')
      ]);
      const docJson = await docRes.json();
      const orgJson = await orgRes.json();

      if (docJson.success) setDocuments(docJson.data || []);
      if (orgJson.success) {
        setOrganizations(orgJson.data || []);
        if (orgJson.data?.length > 0 && !formData.organizationId) {
          setFormData((p) => ({ ...p, organizationId: orgJson.data[0]._id }));
        }
      }
    } catch (e) {
      console.error('Failed to load documents:', e);
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
    if (!formData.title.trim()) {
      setError('Document title is required.');
      return;
    }
    if (formData.sourceType === 'url' && !formData.url.trim()) {
      setError('Document URL is required.');
      return;
    }
    if (formData.sourceType === 'upload' && !formData.fileContentText.trim()) {
      setError('Document text or content is required.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          fileSize: formData.fileContentText ? formData.fileContentText.length : 0
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add document');
      }

      setSuccess(`Document "${data.data.title}" added successfully.`);
      setShowModal(false);
      setFormData((p) => ({
        ...p,
        title: '',
        url: '',
        fileContentText: '',
        fileName: ''
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
            <FileText className="w-5 h-5 text-[#2d523e]" />
            <span>Privacy Documents & Regulatory Policies</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage Privacy Policies, Consent Notices, and Data Retention schedules for DPDP cross-examination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs"
            title="Refresh Documents"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setError('');
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#2d523e] hover:bg-[#234131] text-white shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Document</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Document List or Empty State */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Privacy Documents Recorded"
          description="Provide privacy policy URLs or upload policy schedules to enable automated DPDP Section 6 notice alignment checks."
          primaryActionText="Add Document"
          primaryActionHref="#"
          secondaryActionText="Run Onboarding Wizard"
          secondaryActionHref="/onboarding"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <div
              key={doc._id}
              className="p-5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 transition-all space-y-3 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
                    {doc.documentType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize">
                    {doc.sourceType}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm leading-snug">
                  {doc.title}
                </h3>

                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#2d523e] hover:underline flex items-center gap-1 font-mono truncate"
                  >
                    <span className="truncate">{doc.url}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                ) : (
                  <p className="text-xs text-slate-500 font-mono">
                    Text Document &bull; {doc.textLength || 0} characters
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Retention: {doc.retentionUntil ? new Date(doc.retentionUntil).getFullYear() : 'Statutory'}
                </span>
                {doc.extractedText && (
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    className="text-[#2d523e] hover:text-[#1e382a] inline-flex items-center gap-1 font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Text</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Document Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#2d523e]" />
                  <span>Add Privacy Policy or Notice</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Supply URL or text excerpt with statutory access controls and SSRF safety checks.
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
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
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
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
                >
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Document Category *
                  </label>
                  <select
                    value={formData.documentType}
                    onChange={(e) => setFormData((p) => ({ ...p, documentType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
                  >
                    <option value="privacy_policy">Privacy Policy</option>
                    <option value="terms_of_service">Terms of Service</option>
                    <option value="consent_notice">Consent Notice (Sec 6)</option>
                    <option value="data_retention_policy">Data Retention Policy</option>
                    <option value="grievance_policy">Grievance Policy</option>
                    <option value="other">Other Document</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Master Privacy Notice 2026"
                    value={formData.title}
                    onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs focus:border-[#2d523e] focus:outline-none"
                  />
                </div>
              </div>

              {/* Source Type Toggle */}
              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  Source Ingestion Method
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, sourceType: 'url' }))}
                    className={`py-2 rounded-lg font-semibold text-xs border transition-all ${
                      formData.sourceType === 'url'
                        ? 'bg-[#eaf2ed] text-[#2d523e] border-[#d0e2d5]'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    Web URL Reference
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((p) => ({ ...p, sourceType: 'upload' }))}
                    className={`py-2 rounded-lg font-semibold text-xs border transition-all ${
                      formData.sourceType === 'upload'
                        ? 'bg-[#eaf2ed] text-[#2d523e] border-[#d0e2d5]'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    Text Excerpt Input
                  </button>
                </div>
              </div>

              {formData.sourceType === 'url' ? (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Live Document URL *
                  </label>
                  <input
                    type="url"
                    placeholder="https://example.com/privacy"
                    value={formData.url}
                    onChange={(e) => setFormData((p) => ({ ...p, url: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-xs focus:border-[#2d523e] focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Policy Text Excerpt (Max 100,000 characters) *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Paste full text or relevant excerpt of privacy terms..."
                    value={formData.fileContentText}
                    onChange={(e) => setFormData((p) => ({ ...p, fileContentText: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-xs font-mono focus:border-[#2d523e] focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234131] text-white shadow-xs transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{previewDoc.title}</h3>
                <span className="text-[10px] text-slate-500 uppercase">
                  {previewDoc.documentType.replace(/_/g, ' ')}
                </span>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
              {previewDoc.extractedText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
