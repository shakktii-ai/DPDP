'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Globe,
  FileCheck2,
  Clock,
  ArrowRight,
  Shield,
  PlusCircle,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  RotateCcw,
  Scale,
  Info,
  HelpCircle
} from 'lucide-react';
import ReassessmentModal from '@/components/ReassessmentModal';

export default function CustomerWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedAssessmentForRerun, setSelectedAssessmentForRerun] = useState(null);

  const fetchWorkspaceData = async () => {
    try {
      setLoading(true);
      const [userRes, reportsRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/reports'),
      ]);

      const userData = await userRes.json();
      const reportsData = await reportsRes.json();

      if (userData.success && userData.user) {
        setUser(userData.user);
      }

      if (reportsData.success && reportsData.reports) {
        setAssessments(reportsData.reports);
      }
    } catch (err) {
      console.error('Failed to load customer workspace:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, []);

  const latestAssessment = assessments[0] || null;

  const getStatusBadge = (item) => {
    if (!item) return { label: 'Queued', color: 'bg-stone-100 text-stone-600 border-stone-200' };
    if (item.status === 'in_progress') {
      return { label: 'Running', color: 'bg-sky-50 text-sky-700 border-sky-200 animate-pulse' };
    }
    if (item.status === 'failed') {
      return { label: 'Failed', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    }
    if (
      item.status === 'needs_attention' ||
      (item.status === 'completed' && item.counts && item.counts.fail > 0 && item.counts.pass === 0)
    ) {
      return { label: 'Needs Attention', color: 'bg-amber-50 text-amber-800 border-amber-200' };
    }
    if (item.status === 'completed') {
      return { label: 'Completed', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    return {
      label: item.status?.replace(/_/g, ' ') || 'Queued',
      color: 'bg-stone-100 text-stone-600 border-stone-200',
    };
  };

  const getScoreStyle = (score) => {
    if (score === null || score === undefined) {
      return 'bg-stone-50 text-stone-600 border-stone-200';
    }
    if (score >= 80) {
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    }
    if (score >= 50) {
      return 'bg-amber-50 text-amber-800 border-amber-200';
    }
    return 'bg-rose-50 text-rose-800 border-rose-200';
  };

  return (
    <div className="space-y-8">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
              Customer Workspace
            </span>
            {user?.name && (
              <span className="text-xs text-stone-500 font-medium">
                &bull; {user.name}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-stone-900 tracking-tight">
            Privacy Assessment Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-stone-500">
            Monitor your organization&apos;s website assessments, view traceable findings, and download compliance reports.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchWorkspaceData}
            className="p-2 rounded-xl bg-white border border-stone-200 text-stone-500 hover:text-stone-800 transition-colors shadow-2xs"
            title="Refresh workspace"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/portal/onboarding"
            id="workspace-new-assessment-btn"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-2xs hover:shadow transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Assessment</span>
          </Link>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-44 bg-white border border-stone-200/90 rounded-2xl animate-pulse" />
          <div className="h-64 bg-white border border-stone-200/90 rounded-2xl animate-pulse" />
        </div>
      ) : assessments.length === 0 ? (
        /* Empty State */
        <div className="p-10 sm:p-14 rounded-3xl bg-white border border-stone-200/90 text-center space-y-4 shadow-2xs max-w-xl mx-auto my-6">
          <div className="w-12 h-12 rounded-2xl bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] flex items-center justify-center mx-auto">
            <Globe className="w-6 h-6 text-[#2d523e]" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-stone-900">No Website Assessments Yet</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
              Start your first automated website privacy assessment to evaluate consent notices, cookie banners, and grievance mechanisms.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/portal/onboarding"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all"
            >
              <span>Start Your First Assessment</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Latest Assessment Highlight Card */}
          {latestAssessment && (() => {
            const statusBadge = getStatusBadge(latestAssessment);
            const scoreVal = latestAssessment.complianceScore;
            const hasScore = scoreVal !== null && scoreVal !== undefined;

            return (
              <div className="p-6 sm:p-8 rounded-3xl bg-white border border-stone-200/90 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-semibold uppercase text-[#2d523e] bg-[#eaf2ed] px-2.5 py-0.5 rounded-full border border-[#d0e2d5]">
                        Latest Assessment
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                        Run #{latestAssessment.sequenceNumber || 1}
                      </span>
                      {latestAssessment.isReassessment && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
                          Reassessment
                        </span>
                      )}
                      <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-stone-900">
                      {latestAssessment.websiteName || latestAssessment.organizationName}
                    </h2>

                    {/* Website URL on separate line with icon to prevent concatenation */}
                    <div className="flex items-center gap-2 text-xs text-stone-500 font-mono">
                      <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <a
                        href={latestAssessment.targetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-stone-800 hover:underline inline-flex items-center gap-1 truncate max-w-sm sm:max-w-md"
                        title="Open assessed website in new tab"
                      >
                        <span>{latestAssessment.targetUrl}</span>
                        <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                      </a>
                    </div>
                  </div>

                  {/* Score Callout with Methodology Tooltip */}
                  <div className="flex items-center gap-4 self-start sm:self-auto">
                    <div className="relative group/score">
                      <div className={`p-4 rounded-2xl border text-center min-w-[100px] ${getScoreStyle(scoreVal)}`}>
                        <span className="text-3xl font-black leading-none block">
                          {hasScore ? `${scoreVal}%` : (latestAssessment.scoreDisplay || 'Not calculated')}
                        </span>
                        <span className="text-[9px] uppercase font-bold tracking-wider mt-1 block opacity-80">
                          Compliance Index
                        </span>
                      </div>

                      {/* Score Tooltip */}
                      <div className="absolute top-full right-0 mt-2 hidden group-hover/score:block z-30 w-72 p-3 rounded-xl bg-stone-900 text-white text-[11px] leading-relaxed shadow-xl pointer-events-none">
                        <div className="font-semibold text-stone-200 mb-1 flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>DPDP Scoring Methodology</span>
                        </div>
                        <p className="text-stone-300">
                          Formula: Compliant ÷ (Compliant + Action Needed + Needs Review) × 100.
                        </p>
                        <p className="text-stone-400 mt-1.5 text-[10px]">
                          Not Applicable and Not Tested checkpoints are excluded from denominator. Needs Review checkpoints are not counted as compliant.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Counts Breakdown Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-center">
                    <span className="text-base font-bold text-emerald-700 block">
                      {latestAssessment.counts?.pass || 0}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide">
                      Compliant (Pass)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-200/80 text-center">
                    <span className="text-base font-bold text-rose-700 block">
                      {latestAssessment.counts?.fail || 0}
                    </span>
                    <span className="text-[10px] font-semibold text-rose-800 uppercase tracking-wide">
                      Action Needed (Fail)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-center">
                    <span className="text-base font-bold text-amber-700 block">
                      {latestAssessment.counts?.needs_review || 0}
                    </span>
                    <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
                      Needs Review
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-center">
                    <span className="text-base font-bold text-stone-600 block">
                      {latestAssessment.counts?.not_applicable || 0}
                    </span>
                    <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">
                      Not Applicable
                    </span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-stone-400 text-[11px] flex-wrap">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      Assessed: {new Date(latestAssessment.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                    <span>&bull;</span>
                    <span className="text-stone-600 font-medium">
                      {latestAssessment.totalFindings || 0} statutory checks
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {latestAssessment.hasComparableRuns && (
                      <Link
                        href={`/portal/assessments/${latestAssessment.assessmentId}/compare`}
                        id="latest-compare-btn"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#d0e2d5] text-[#2d523e] hover:bg-[#f7f9f7] font-semibold text-xs shadow-2xs transition-colors"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Compare Reports</span>
                      </Link>
                    )}

                    <button
                      onClick={() => setSelectedAssessmentForRerun(latestAssessment)}
                      id="latest-reassess-btn"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#2d523e] text-[#2d523e] hover:bg-[#eaf2ed] font-bold text-xs shadow-2xs transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Run Reassessment</span>
                    </button>

                    {latestAssessment.status === 'in_progress' ? (
                      <Link
                        href={`/portal/assessments/${latestAssessment.assessmentId}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2d523e] text-white font-semibold text-xs shadow-2xs hover:bg-[#234232] transition-colors"
                      >
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>Monitor Live Progress</span>
                      </Link>
                    ) : (
                      <Link
                        href={`/portal/reports/${latestAssessment.assessmentId}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#2d523e] text-white font-semibold text-xs shadow-2xs hover:bg-[#234232] transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>View Customer Report</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Past Assessments List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900">Assessment History</h3>
              <span className="text-xs text-stone-400 font-medium">
                {assessments.length} total recorded
              </span>
            </div>

            <div className="space-y-3">
              {assessments.map((item) => {
                const statusBadge = getStatusBadge(item);
                const scoreVal = item.complianceScore;
                const hasScore = scoreVal !== null && scoreVal !== undefined;

                return (
                  <div
                    key={item._id}
                    className="p-5 rounded-2xl bg-white border border-stone-200/90 hover:border-stone-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs group"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      {/* Name & Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-stone-900 text-base group-hover:text-[#2d523e] transition-colors">
                          {item.websiteName || item.organizationName}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200">
                          Run #{item.sequenceNumber || 1}
                        </span>
                        {item.isReassessment && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
                            Reassessment
                          </span>
                        )}
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Clean URL on separate line to avoid concatenation */}
                      <div className="flex items-center gap-1.5 text-xs text-stone-500 font-mono">
                        <Globe className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <a
                          href={item.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-stone-800 hover:underline truncate max-w-sm sm:max-w-md inline-flex items-center gap-1"
                          title={`Open ${item.targetUrl} in new tab`}
                        >
                          <span>{item.targetUrl}</span>
                          <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                        </a>
                      </div>

                      {/* 4 Counts Breakdown Pills */}
                      <div className="flex items-center gap-2 flex-wrap pt-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{item.counts?.pass ?? 0} Pass</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>{item.counts?.fail ?? 0} Action Needed</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
                          <HelpCircle className="w-3 h-3 text-amber-600" />
                          <span>{item.counts?.needs_review ?? 0} Review</span>
                        </span>

                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-50 text-stone-600 border border-stone-200 text-[11px] font-semibold">
                          <span>{item.counts?.not_applicable ?? 0} N/A</span>
                        </span>

                        <span className="text-[11px] text-stone-400 ml-1">
                          &bull; Assessed: {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>

                    {/* Right Side: Score Pill + Actions */}
                    <div className="flex items-center gap-3 text-xs self-start lg:self-auto flex-wrap">
                      {/* Score Badge with Explanatory Tooltip */}
                      <div className="relative group/score">
                        <div className={`p-2.5 rounded-xl text-center min-w-[76px] border ${getScoreStyle(scoreVal)}`}>
                          <span className="text-lg font-black leading-none block">
                            {hasScore ? `${scoreVal}%` : (item.scoreDisplay || 'Not calculated')}
                          </span>
                          <span className="text-[9px] uppercase font-bold tracking-wider block mt-0.5 opacity-80">
                            Compliance
                          </span>
                        </div>

                        {/* Hover Tooltip */}
                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover/score:block z-20 w-64 p-2.5 rounded-xl bg-stone-900 text-white text-[11px] leading-relaxed shadow-lg pointer-events-none">
                          <div className="font-semibold text-stone-200 mb-1 flex items-center gap-1">
                            <Info className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>DPDP Compliance Scoring</span>
                          </div>
                          <p className="text-stone-300">
                            Formula: Compliant ÷ (Compliant + Action Needed + Needs Review) × 100.
                          </p>
                          <p className="text-stone-400 mt-1 text-[10px]">
                            Not Applicable and Not Tested checkpoints are excluded from denominator. Needs Review is not treated as pass.
                          </p>
                        </div>
                      </div>

                      {/* View Details / Live Inspection */}
                      <Link
                        href={`/portal/assessments/${item.assessmentId}`}
                        className="px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold transition-colors"
                        title="View Live Inspection and Evidence"
                      >
                        {item.status === 'in_progress' ? 'Track Live' : 'Details'}
                      </Link>

                      {/* View Report */}
                      {item.status === 'completed' && (
                        <Link
                          href={`/portal/reports/${item.assessmentId}`}
                          className="px-3.5 py-2 rounded-xl bg-[#2d523e] hover:bg-[#234232] text-white text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Report</span>
                        </Link>
                      )}

                      {/* Compare Reports if sibling runs exist */}
                      {item.hasComparableRuns && (
                        <Link
                          href={`/portal/assessments/${item.assessmentId}/compare`}
                          className="px-3 py-2 rounded-xl bg-white border border-[#d0e2d5] hover:bg-[#f7f9f7] text-[#2d523e] text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                          title="Compare with Previous Assessment"
                        >
                          <Scale className="w-3.5 h-3.5" />
                          <span>Compare</span>
                        </Link>
                      )}

                      {/* Run Reassessment Button */}
                      <button
                        onClick={() => setSelectedAssessmentForRerun(item)}
                        className="p-2 rounded-xl text-stone-500 hover:text-[#2d523e] hover:bg-[#eaf2ed] border border-stone-200 hover:border-[#d0e2d5] transition-colors"
                        title="Run Reassessment for this Website"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Reassessment Modal for Workspace History */}
      {selectedAssessmentForRerun && (
        <ReassessmentModal
          isOpen={Boolean(selectedAssessmentForRerun)}
          onClose={() => setSelectedAssessmentForRerun(null)}
          assessment={selectedAssessmentForRerun}
          targetUrl={selectedAssessmentForRerun.targetUrl}
          websiteName={selectedAssessmentForRerun.websiteName || selectedAssessmentForRerun.targetName || selectedAssessmentForRerun.organizationName}
          currentSequence={selectedAssessmentForRerun.sequenceNumber || 1}
        />
      )}
    </div>
  );
}
