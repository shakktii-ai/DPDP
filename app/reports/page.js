'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Search,
  Scale,
  Sparkles,
  ArrowUpRight,
  Eye,
  Info
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [downloadingType, setDownloadingType] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports');
      const data = await res.json();
      if (data.success && data.reports) {
        setReports(data.reports);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDownload = async (assessmentId, format) => {
    try {
      setDownloadingId(assessmentId);
      setDownloadingType(format);
      const res = await fetch(`/api/reports?assessmentId=${assessmentId}&format=${format}`);
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DPDP-Compliance-Report-${assessmentId.slice(-6)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Error generating report: ${err.message}`);
    } finally {
      setDownloadingId(null);
      setDownloadingType(null);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.organizationName?.toLowerCase().includes(q) ||
      r.targetUrl?.toLowerCase().includes(q) ||
      r.name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="space-y-1 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eaf2ed] border border-[#d0e2d5] text-[#2d523e] text-xs font-semibold">
            <Scale className="w-3.5 h-3.5" />
            <span>DPDP Act, 2023 & DPDP Rules, 2025 Legal Registry</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Compliance & Audit Reports
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Official evidence-based DPDP assessment reports. Includes executive metrics, requirement-by-requirement determinations, empirical technical facts, and remediation roadmaps.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 self-start sm:self-auto">
          <button
            onClick={fetchReports}
            className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all border border-slate-200 shadow-xs"
            title="Refresh Reports"
            id="refresh-reports-btn"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/assessments/new"
            id="new-assessment-report-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Launch Assessment</span>
          </Link>
        </div>
      </div>

      {/* Statutory Authority Callout */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Authoritative Statutory Standards Enforced</h4>
            <p className="text-xs text-slate-600">
              Evaluated strictly against published gazette provisions: MeitY DPDP Act 2023 & DPDP Rules 2025. Non-enforceable draft proposals are classified separately.
            </p>
          </div>
        </div>
        <a
          href="https://www.meity.gov.in/dpdp-rules-2025"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2d523e] hover:underline flex-shrink-0"
        >
          <span>Official MeitY Portal</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by organization or target URL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-xs transition-colors"
          />
        </div>
        <span className="text-xs text-slate-500">
          Showing {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'}
        </span>
      </div>

      {/* Reports Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-52 bg-slate-100 border border-slate-200 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Assessment Reports Generated Yet"
          description="Reports are automatically synthesized once an assessment pipeline finishes executing and analyzing all compliance checkpoints."
          primaryActionText="Start Assessment"
          primaryActionHref="/assessments/new"
          secondaryActionText="View Assessments Queue"
          secondaryActionHref="/assessments"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredReports.map((rep) => {
            const isDownloadingPdf = downloadingId === rep._id && downloadingType === 'pdf';
            const isDownloadingXls = downloadingId === rep._id && downloadingType === 'excel';
            const hasScore = rep.complianceScore !== null && rep.complianceScore !== undefined;
            const scoreColor = !hasScore
              ? 'text-slate-600 border-slate-200 bg-slate-50'
              : rep.complianceScore >= 80
              ? 'text-emerald-800 border-emerald-200 bg-emerald-50'
              : rep.complianceScore >= 50
              ? 'text-amber-800 border-amber-200 bg-amber-50'
              : 'text-rose-800 border-rose-200 bg-rose-50';

            return (
              <div
                key={rep._id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all hover:shadow-md space-y-4 relative group shadow-xs"
              >
                {/* Card Top: Organization & Score */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-semibold uppercase text-[#2d523e] bg-[#eaf2ed] px-2 py-0.5 rounded border border-[#d0e2d5]">
                      Audit Report
                    </span>
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-[#2d523e] transition-colors">
                      {rep.websiteName || rep.organizationName}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono truncate max-w-xs">
                      {rep.targetUrl}
                    </p>
                  </div>

                  <div className={`px-3 py-2 rounded-xl border flex flex-col items-center justify-center flex-shrink-0 ${scoreColor}`}>
                    <span className="text-xl font-bold leading-none">
                      {hasScore ? `${rep.complianceScore}%` : (rep.scoreDisplay || 'Not calculated')}
                    </span>
                    <span className="text-[9px] uppercase font-bold tracking-wider mt-0.5">DPDP Index</span>
                  </div>
                </div>

                {/* Metrics Breakdown Chips */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
                    <span className="text-xs font-bold text-emerald-800 block">{rep.counts?.pass || 0}</span>
                    <span className="text-[9px] text-slate-500 uppercase font-medium">Pass</span>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-center">
                    <span className="text-xs font-bold text-rose-800 block">{rep.counts?.fail || 0}</span>
                    <span className="text-[9px] text-slate-500 uppercase font-medium">Fail</span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-center">
                    <span className="text-xs font-bold text-amber-800 block">{rep.counts?.needs_review || 0}</span>
                    <span className="text-[9px] text-slate-500 uppercase font-medium">Review</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center">
                    <span className="text-xs font-bold text-slate-700 block">{rep.counts?.not_applicable || 0}</span>
                    <span className="text-[9px] text-slate-500 uppercase font-medium">N/A</span>
                  </div>
                </div>

                {/* Footer Info & Download Actions */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400 text-[11px]">
                    Created: {new Date(rep.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Excel Export Button */}
                    <button
                      onClick={() => handleDownload(rep._id, 'excel')}
                      disabled={isDownloadingXls}
                      id={`export-excel-${rep._id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-all disabled:opacity-50"
                      title="Download Multi-Tab Excel Workbook"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>{isDownloadingXls ? 'Building...' : 'Excel'}</span>
                    </button>

                    {/* PDF Export Button */}
                    <button
                      onClick={() => handleDownload(rep._id, 'pdf')}
                      disabled={isDownloadingPdf}
                      id={`export-pdf-${rep._id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#2d523e] hover:bg-[#234232] text-white font-semibold text-xs shadow-xs transition-all disabled:opacity-50"
                      title="Download Official PDF Report"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{isDownloadingPdf ? 'Generating...' : 'PDF Report'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
