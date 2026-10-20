'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Info,
  Globe,
  Camera,
  Layers,
  Sparkles,
  BookOpen,
  Scale,
  Calendar,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
  X
} from 'lucide-react';
import ReassessmentModal from '@/components/ReassessmentModal';

export default function CustomerReportPage({ params }) {
  const unwrappedParams = use(params);
  const assessmentId = unwrappedParams.id;

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingExcel, setDownloadingExcel] = useState(false);
  const [previewScreenshot, setPreviewScreenshot] = useState(null);
  const [reassessModalOpen, setReassessModalOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/reports?assessmentId=${assessmentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.report) {
          setReport(data.report);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assessmentId]);

  const handleDownload = async (format) => {
    try {
      if (format === 'pdf') setDownloadingPdf(true);
      if (format === 'excel') setDownloadingExcel(true);

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
      alert(`Error downloading report: ${err.message}`);
    } finally {
      setDownloadingPdf(false);
      setDownloadingExcel(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="h-44 bg-white border border-stone-200 rounded-3xl animate-pulse" />
        <div className="h-96 bg-white border border-stone-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-stone-900">Report Not Found</h2>
        <p className="text-xs text-stone-500">
          The requested assessment report could not be loaded or you are not authorized to view it.
        </p>
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 text-stone-700"
        >
          <span>Return to Workspace</span>
        </Link>
      </div>
    );
  }

  const { organization, target, complianceScore, counts, findings } = report;

  const filteredFindings = findings.filter((f) => {
    if (activeCategory === 'all') return true;
    return f.status === activeCategory;
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Workspace</span>
        </Link>

        {/* Action Buttons: Download, Compare, Reassess */}
        <div className="flex flex-wrap items-center gap-2">
          {report.previousAssessmentId && (
            <Link
              href={`/portal/reports/${report.previousAssessmentId}`}
              id="report-view-prev-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-semibold shadow-2xs transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-stone-400" />
              <span>Previous Report</span>
            </Link>
          )}

          {report.hasComparableRuns && (
            <Link
              href={`/portal/assessments/${assessmentId}/compare`}
              id="report-compare-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#f7f9f7] border border-[#d0e2d5] text-[#2d523e] text-xs font-semibold shadow-2xs transition-all"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Compare Reports</span>
            </Link>
          )}

          <button
            onClick={() => setReassessModalOpen(true)}
            id="report-reassess-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#eaf2ed] border border-[#2d523e] text-[#2d523e] text-xs font-bold shadow-2xs transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Run Reassessment</span>
          </button>

          <button
            onClick={() => handleDownload('excel')}
            disabled={downloadingExcel}
            id="customer-download-excel-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-semibold shadow-2xs transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>{downloadingExcel ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          <button
            onClick={() => handleDownload('pdf')}
            disabled={downloadingPdf}
            id="customer-download-pdf-btn"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2d523e] hover:bg-[#234232] text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{downloadingPdf ? 'Generating PDF...' : 'Download PDF Report'}</span>
          </button>
        </div>
      </div>

      {/* Report Header Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200/90 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
                Official Assessment
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                Run #{report.sequenceNumber || 1}
              </span>
              {report.isReassessment && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Reassessment
                </span>
              )}
              <span className="text-xs text-stone-400">&bull;</span>
              <span className="text-xs text-stone-500">
                {new Date(report.assessment?.createdAt || Date.now()).toLocaleDateString('en-IN', { dateStyle: 'long' })}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
              DPDP Compliance Assessment Report
            </h1>

            <p className="text-xs text-stone-600 font-medium">
              Prepared for <strong>{organization?.name || 'Authorized Organization'}</strong> &bull; Sector: {organization?.industry || 'Technology'}
            </p>

            <div className="flex items-center gap-2 pt-1 text-xs text-stone-500 font-mono">
              <Globe className="w-3.5 h-3.5 text-stone-400" />
              <span>{target?.url || 'Evaluated Website Domain'}</span>
            </div>
          </div>

          {/* Compliance Score Hero Badge */}
          <div className="p-5 rounded-2xl bg-[#f7f9f7] border border-[#d0e2d5] text-center min-w-[120px] self-start sm:self-auto">
            <span className="text-4xl font-extrabold text-[#2d523e] leading-none block">
              {complianceScore !== null && complianceScore !== undefined ? `${complianceScore}%` : (report.scoreDisplay || 'Not calculated')}
            </span>
            <span className="text-[10px] uppercase font-bold text-stone-500 tracking-wider mt-1 block">
              Compliance Index
            </span>
          </div>
        </div>

        {/* Executive Summary Narrative */}
        <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 text-xs text-stone-700 space-y-1.5">
          <span className="font-semibold text-stone-900 block">Executive Summary</span>
          <p className="leading-relaxed">
            {complianceScore === null || complianceScore === undefined
              ? 'This assessment is either in progress or could not evaluate sufficient checkpoints to calculate a compliance index.'
              : complianceScore >= 80
              ? 'Your website demonstrates strong alignment with core requirements under the Digital Personal Data Protection Act, 2023. Key disclosures and affirmative consent options were observed. A few minor points require attention below.'
              : complianceScore >= 50
              ? 'Your website partially meets DPDP standards. While some notice elements were observed, critical action items (such as Grievance Officer details or 1-click cookie withdrawal) require remediation to prevent regulatory non-conformity.'
              : 'Your website requires immediate attention to comply with statutory DPDP requirements. Several mandatory disclosures, affirmative consent mechanisms, or security safeguards were missing or incomplete.'}
          </p>
          <div className="mt-2 pt-2 border-t border-stone-200/60 text-[11px] text-stone-500 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
            <span>
              <strong>Scoring Methodology:</strong> {report.scoreMethodology?.formula || 'Compliant ÷ (Compliant + Action Needed + Needs Review) × 100'}. Not Applicable and Not Tested checkpoints are excluded from denominator. Needs Review is not counted as compliant.
            </span>
          </div>
        </div>

        {/* Status Metrics Breakdown Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-white border border-stone-200 text-center">
            <span className="text-base font-bold text-emerald-700 block">{counts?.pass || 0}</span>
            <span className="text-[10px] uppercase font-semibold text-stone-500">Compliant (Pass)</span>
          </div>
          <div className="p-3 rounded-xl bg-white border border-stone-200 text-center">
            <span className="text-base font-bold text-rose-700 block">{counts?.fail || 0}</span>
            <span className="text-[10px] uppercase font-semibold text-stone-500">Action Needed (Fail)</span>
          </div>
          <div className="p-3 rounded-xl bg-white border border-stone-200 text-center">
            <span className="text-base font-bold text-amber-700 block">{counts?.needs_review || 0}</span>
            <span className="text-[10px] uppercase font-semibold text-stone-500">Needs Review</span>
          </div>
          <div className="p-3 rounded-xl bg-white border border-stone-200 text-center">
            <span className="text-base font-bold text-stone-500 block">{counts?.not_applicable || 0}</span>
            <span className="text-[10px] uppercase font-semibold text-stone-400">Not Applicable</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-stone-100 rounded-xl overflow-x-auto text-xs">
        {[
          { key: 'all', label: 'All Checkpoints' },
          { key: 'fail', label: `Action Needed (${counts.fail})` },
          { key: 'needs_review', label: `Under Review (${counts.needs_review})` },
          { key: 'pass', label: `Compliant (${counts.pass})` },
          { key: 'not_applicable', label: `Not Applicable (${counts.not_applicable})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveCategory(tab.key)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeCategory === tab.key
                ? 'bg-white text-stone-900 font-bold shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Findings List */}
      <div className="space-y-4">
        {filteredFindings.map((item) => {
          const statusConfig = {
            pass: { label: 'Compliant', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
            fail: { label: 'Action Needed', color: 'bg-rose-50 text-rose-800 border-rose-200', icon: XCircle },
            needs_review: { label: 'Needs Review', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: AlertTriangle },
            not_applicable: { label: 'Not Applicable', color: 'bg-stone-100 text-stone-600 border-stone-200', icon: HelpCircle },
            not_tested: { label: 'Not Tested', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Info },
          }[item.status] || { label: item.status, color: 'bg-stone-100', icon: Info };

          const StatusIcon = statusConfig.icon;

          return (
            <div
              key={item._id}
              className="p-6 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-4"
            >
              {/* Finding Title & Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold text-[#2d523e] bg-[#eaf2ed] px-2 py-0.5 rounded border border-[#d0e2d5]">
                      {item.ruleId}
                    </span>
                    <span className="text-xs text-stone-500 font-medium">
                      {item.category}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-stone-900 pt-0.5">
                    {item.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${statusConfig.color}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span>{statusConfig.label}</span>
                  </span>
                </div>
              </div>

              {/* Observed Facts vs AI Interpretation (Distinguished Clearly) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Empirical Observations */}
                <div className="p-3.5 rounded-xl bg-[#fafaf9] border border-stone-200 space-y-1">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-stone-500" />
                    <span>Observed Technical Facts</span>
                  </span>
                  {item.observedFacts && item.observedFacts.length > 0 ? (
                    <ul className="text-stone-600 space-y-1 list-disc list-inside pt-1">
                      {item.observedFacts.map((fact, idx) => (
                        <li key={idx} className="leading-relaxed">{fact}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-stone-400 italic">No empirical observations recorded.</p>
                  )}
                </div>

                {/* Statutory AI Interpretation */}
                <div className="p-3.5 rounded-xl bg-[#fafaf9] border border-stone-200 space-y-1">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Statutory Impact & Context</span>
                  </span>
                  <p className="text-stone-600 leading-relaxed pt-1">
                    {item.aiInterpretation || item.explanation}
                  </p>
                </div>
              </div>

              {/* Remediation Action Callout */}
              <div className="p-3.5 rounded-xl bg-[#eaf2ed]/50 border border-[#d0e2d5] text-xs space-y-1">
                <span className="font-semibold text-[#2d523e] flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>How to Fix / Recommended Action</span>
                </span>
                <p className="text-stone-700 leading-relaxed">
                  {item.recommendedRemediation || 'No action required at this time.'}
                </p>
              </div>

              {/* Screenshot Preview Trigger */}
              {item.evidence?.screenshotUrl && (
                <div className="pt-1 text-right">
                  <button
                    onClick={() => setPreviewScreenshot(item.evidence.screenshotUrl)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#2d523e] hover:text-[#234232] font-semibold"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>View Captured Evidence Screenshot</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Explicit Limitations Section (Per Requirement) */}
      <div className="p-6 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
          <Info className="w-4 h-4 text-stone-500" />
          <span>Assessment Scope & Explicit Limitations</span>
        </h3>
        <ul className="text-xs text-stone-600 space-y-1.5 list-disc list-inside leading-relaxed">
          <li><strong>Client-Side Only:</strong> This inspection evaluated rendered client-side web pages, cookie consent scripts, and published documents. Internal production databases, offline storage, and employee procedures were not inspected.</li>
          <li><strong>Two-Factor Authentication:</strong> Portions of your application requiring SMS OTP or hardware authentication tokens require manual verification.</li>
          <li><strong>Dynamic Code:</strong> Third-party scripts injected dynamically based on geo-location or behavioral conditions outside India were not part of this evaluation.</li>
        </ul>
      </div>

      {/* Mandatory Statutory Disclaimer Card */}
      <div className="p-5 rounded-2xl bg-stone-100 border border-stone-200 text-stone-600 text-xs space-y-2">
        <span className="font-semibold text-stone-900 block">Regulatory Compliance Notice</span>
        <p className="leading-relaxed text-[11px]">
          This document is an automated technical diagnostic report provided as an assessment aid. It <strong>does not constitute a government certification</strong>, legal advice, or a guarantee of compliance from the Data Protection Board of India (DPBI). Organizations should retain qualified legal counsel to perform formal compliance audits.
        </p>
      </div>

      {/* Screenshot Modal Lightbox */}
      {previewScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewScreenshot(null)}
        >
          <div className="max-w-4xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-2 border border-stone-200">
            <div className="flex justify-between items-center px-3 py-2 border-b border-stone-100">
              <span className="text-xs font-semibold text-stone-700">Evidence Screenshot</span>
              <button
                onClick={() => setPreviewScreenshot(null)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2">
              <img src={previewScreenshot} alt="Evidence" className="w-full h-auto rounded-lg" />
            </div>
          </div>
        </div>
      )}
      {/* Reassessment Modal */}
      <ReassessmentModal
        isOpen={reassessModalOpen}
        onClose={() => setReassessModalOpen(false)}
        assessment={report.assessment}
        targetUrl={target?.url}
        websiteName={target?.name}
        currentSequence={report.sequenceNumber || 1}
      />
    </div>
  );
}
