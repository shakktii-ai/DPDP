'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Camera,
  BookOpen,
  Filter,
  Check,
  Edit3,
  X,
  ExternalLink,
  Scale,
  Sparkles,
  Info,
  Calendar,
  Layers
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';

export default function FindingsPage() {
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  
  // Human Review Modal state
  const [reviewingFinding, setReviewingFinding] = useState(null);
  const [reviewDecision, setReviewDecision] = useState('approved');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [amendedExplanation, setAmendedExplanation] = useState('');
  const [amendedSeverity, setAmendedSeverity] = useState('medium');
  const [savingReview, setSavingReview] = useState(false);

  const fetchFindings = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/findings');
      const data = await res.json();
      if (data.success && data.findings) {
        setFindings(data.findings);
      }
    } catch (err) {
      console.error('Failed to load findings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, []);

  const openReviewModal = (finding) => {
    setReviewingFinding(finding);
    setReviewDecision(finding.reviewerDecision || 'approved');
    setReviewerNotes(finding.reviewerNotes || '');
    setAmendedExplanation(finding.explanation || '');
    setAmendedSeverity(finding.severity || 'medium');
  };

  const handleSaveReview = async () => {
    if (!reviewingFinding) return;
    try {
      setSavingReview(true);
      const res = await fetch('/api/findings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingId: reviewingFinding._id,
          reviewerDecision: reviewDecision,
          reviewerNotes,
          explanation: reviewDecision === 'amended' ? amendedExplanation : undefined,
          severity: reviewDecision === 'amended' ? amendedSeverity : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state
        setFindings((prev) =>
          prev.map((f) => (f._id === reviewingFinding._id ? data.finding : f))
        );
        setReviewingFinding(null);
      } else {
        alert(data.error || 'Failed to update finding');
      }
    } catch (err) {
      alert(`Error updating review: ${err.message}`);
    } finally {
      setSavingReview(false);
    }
  };

  const filtered = findings.filter((f) => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false;
    if (decisionFilter !== 'all' && f.reviewerDecision !== decisionFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eaf2ed] border border-[#d0e2d5] text-[#2d523e] text-xs font-semibold">
            <Scale className="w-3.5 h-3.5" />
            <span>Traceable Legal Finding Engine</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            DPDP Findings & Human Review Board
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Distinguishes empirical technical facts from AI statutory reasoning. Authorized reviewers can evaluate, amend, approve, or reject legal determinations.
          </p>
        </div>

        <Link
          href="/assessments/new"
          id="launch-new-assessment-btn"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all self-start sm:self-auto"
        >
          <span>Run New Assessment</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 px-2">Status:</span>
          {['all', 'pass', 'fail', 'needs_review', 'not_applicable', 'not_tested'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                statusFilter === st
                  ? 'bg-[#eaf2ed] text-[#2d523e] font-bold border border-[#d0e2d5]'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-slate-500 px-2">Review:</span>
          {['all', 'pending', 'approved', 'amended', 'rejected'].map((dec) => (
            <button
              key={dec}
              onClick={() => setDecisionFilter(dec)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                decisionFilter === dec
                  ? 'bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {dec}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-100 border border-slate-200 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title="No Findings Match Your Filters"
          description="Synthesized compliance findings appear here once an automated Playwright crawler or Gemini assessment run completes."
          primaryActionText="Launch Browser Inspection"
          primaryActionHref="/testing"
          secondaryActionText="View Approved Targets"
          secondaryActionHref="/targets"
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => {
            const statusConfig = {
              pass: { label: 'PASS', color: 'text-emerald-800 bg-emerald-50 border-emerald-200', icon: CheckCircle2 },
              fail: { label: 'FAIL', color: 'text-rose-800 bg-rose-50 border-rose-200', icon: XCircle },
              needs_review: { label: 'NEEDS REVIEW', color: 'text-amber-800 bg-amber-50 border-amber-200', icon: AlertTriangle },
              not_applicable: { label: 'NOT APPLICABLE', color: 'text-slate-600 bg-slate-100 border-slate-200', icon: HelpCircle },
              not_tested: { label: 'NOT TESTED', color: 'text-sky-800 bg-sky-50 border-sky-200', icon: Info },
            }[item.status] || { label: item.status, color: 'text-slate-600 bg-slate-100', icon: Info };

            const StatusIcon = statusConfig.icon;

            const severityColor = {
              critical: 'bg-rose-50 text-rose-800 border-rose-200 font-semibold',
              high: 'bg-orange-50 text-orange-800 border-orange-200 font-semibold',
              medium: 'bg-amber-50 text-amber-800 border-amber-200',
              low: 'bg-sky-50 text-sky-800 border-sky-200',
              informational: 'bg-slate-100 text-slate-700 border-slate-200',
            }[item.severity] || 'bg-slate-100 text-slate-700';

            return (
              <div
                key={item._id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all space-y-4 shadow-xs hover:shadow-sm"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-[#2d523e] bg-[#eaf2ed] px-2 py-0.5 rounded border border-[#d0e2d5]">
                        {item.requirementId}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityColor}`}>
                        {item.severity}
                      </span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        {item.category}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pt-0.5">
                      <StatusIcon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.ruleId}: {item.title}</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
                    <span className={`text-xs font-bold uppercase px-3 py-1 rounded-lg border ${statusConfig.color}`}>
                      {statusConfig.label}
                    </span>

                    {/* Reviewer Action Button */}
                    <button
                      onClick={() => openReviewModal(item)}
                      id={`review-finding-${item._id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition-all shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#2d523e]" />
                      <span>Review</span>
                    </button>
                  </div>
                </div>

                {/* Empirical Facts vs AI Statutory Interpretation (Phase 5 Requirement) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Empirical Observations */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Layers className="w-3.5 h-3.5 text-[#2d523e]" />
                      <span>Empirical Technical Facts (DOM / HTTP)</span>
                    </div>
                    {item.observedFacts && item.observedFacts.length > 0 ? (
                      <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                        {item.observedFacts.map((fact, idx) => (
                          <li key={idx} className="leading-relaxed">{fact}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic">No empirical observations recorded.</p>
                    )}
                  </div>

                  {/* AI Statutory Reasoning */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Sparkles className="w-3.5 h-3.5 text-slate-600" />
                      <span>AI Statutory Interpretation & Analysis</span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {item.aiInterpretation || item.explanation}
                    </p>
                  </div>
                </div>

                {/* Remediation Guidance */}
                <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-start gap-2.5 text-xs">
                  <div className="p-1 rounded bg-[#eaf2ed] text-[#2d523e] mt-0.5">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-emerald-900">Recommended Remediation: </span>
                    <span className="text-slate-700">{item.recommendedRemediation}</span>
                  </div>
                </div>

                {/* Footer Reviewer Decision Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px]">Human Review Decision:</span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                        item.reviewerDecision === 'approved'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : item.reviewerDecision === 'amended'
                          ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          : item.reviewerDecision === 'rejected'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {item.reviewerDecision || 'pending'}
                    </span>
                    {item.reviewerNotes && (
                      <span className="text-slate-500 text-[11px] italic">
                        &ldquo;{item.reviewerNotes}&rdquo;
                      </span>
                    )}
                  </div>

                  {item.evidence?.screenshotUrl && (
                    <button
                      onClick={() => setSelectedScreenshot(item.evidence.screenshotUrl)}
                      className="inline-flex items-center gap-1.5 text-[#2d523e] hover:underline text-xs font-medium"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>View Screenshot Evidence</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Human Review Modal */}
      {reviewingFinding && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Human Review Workflow</h3>
                <p className="text-xs text-slate-500">
                  {reviewingFinding.requirementId} — {reviewingFinding.ruleId}
                </p>
              </div>
              <button
                onClick={() => setReviewingFinding(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1.5">Reviewer Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  {['approved', 'amended', 'rejected'].map((dec) => (
                    <button
                      key={dec}
                      type="button"
                      onClick={() => setReviewDecision(dec)}
                      className={`py-2 px-3 rounded-xl capitalize font-semibold border text-center transition-all ${
                        reviewDecision === dec
                          ? 'bg-[#2d523e] text-white border-[#2d523e] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {dec}
                    </button>
                  ))}
                </div>
              </div>

              {reviewDecision === 'amended' && (
                <>
                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Amended Statutory Explanation</label>
                    <textarea
                      value={amendedExplanation}
                      onChange={(e) => setAmendedExplanation(e.target.value)}
                      rows={3}
                      className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600 shadow-xs"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-semibold block mb-1">Amended Severity Level</label>
                    <select
                      value={amendedSeverity}
                      onChange={(e) => setAmendedSeverity(e.target.value)}
                      className="w-full p-2 rounded-xl bg-white border border-slate-300 text-slate-900 shadow-xs"
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="informational">Informational</option>
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Reviewer Audit Notes / Justification</label>
                <textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="Record justification for legal interpretation or amendment..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReviewingFinding(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveReview}
                disabled={savingReview}
                className="px-4 py-2 rounded-xl bg-[#2d523e] hover:bg-[#234232] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {savingReview ? 'Saving...' : 'Confirm Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="max-w-4xl w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-2">
            <img src={selectedScreenshot} alt="Evidence Screenshot" className="w-full h-auto rounded-lg" />
            <div className="p-3 text-right">
              <button
                onClick={() => setSelectedScreenshot(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
