'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RotateCcw,
  Sliders,
  Scale,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles,
  ExternalLink,
  FileText,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import ReassessmentModal from '@/components/ReassessmentModal';

export default function AssessmentComparePage({ params }) {
  const unwrappedParams = use(params);
  const assessmentId = unwrappedParams.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBaselineId, setSelectedBaselineId] = useState('');
  const [activeTab, setActiveTab] = useState('scenarios');
  const [reassessModalOpen, setReassessModalOpen] = useState(false);

  const fetchComparison = async (baselineId = '') => {
    try {
      setLoading(true);
      setError('');
      const query = baselineId ? `?baselineId=${baselineId}` : '';
      const res = await fetch(`/api/assessments/${assessmentId}/compare${query}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load comparison data');
      }
      setData(json);
      if (json.baselineAssessment?._id) {
        setSelectedBaselineId(json.baselineAssessment._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComparison();
  }, [assessmentId]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 py-8">
        <div className="h-40 bg-white border border-slate-200 rounded-3xl animate-pulse" />
        <div className="h-96 bg-white border border-slate-200 rounded-3xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto">
          <XCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Comparison Unavailable</h2>
        <p className="text-xs text-slate-500">{error || 'Unable to retrieve comparison data.'}</p>
        <Link
          href={`/portal/assessments/${assessmentId}`}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Assessment</span>
        </Link>
      </div>
    );
  }

  if (!data.hasComparison) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 space-y-4 bg-white p-8 rounded-3xl border border-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] flex items-center justify-center mx-auto">
          <Layers className="w-6 h-6 text-[#2d523e]" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">First Assessment Conducted</h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          {data.message || 'This is the initial assessment recorded for this website. Comparison metrics will become available after running a reassessment.'}
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            href={`/portal/assessments/${assessmentId}`}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
          >
            View Current Assessment
          </Link>
          <button
            onClick={() => setReassessModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#2d523e] hover:bg-[#234232] text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Run Reassessment Now</span>
          </button>
        </div>

        <ReassessmentModal
          isOpen={reassessModalOpen}
          onClose={() => setReassessModalOpen(false)}
          assessment={data.currentAssessment}
          targetUrl={data.currentAssessment?.targetUrl}
          currentSequence={data.currentAssessment?.sequenceNumber || 1}
        />
      </div>
    );
  }

  const {
    currentAssessment,
    baselineAssessment,
    scoreDelta,
    allRuns = [],
    scopeComparison,
    scenarioMatrix = [],
    findingsDiff = {},
  } = data;

  const { resolved = [], new: newlyDetected = [], persistent = [], severityChanges = [] } = findingsDiff;

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-4">
      {/* 1. Navigation Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/portal"
            className="text-slate-500 hover:text-slate-800 font-medium transition-colors"
          >
            Workspace
          </Link>
          <span className="text-slate-300">&bull;</span>
          <Link
            href={`/portal/assessments/${assessmentId}`}
            className="text-slate-500 hover:text-slate-800 font-medium transition-colors"
          >
            Assessment (Run #{currentAssessment.sequenceNumber})
          </Link>
          <span className="text-slate-300">&bull;</span>
          <span className="text-slate-800 font-semibold">Report Comparison</span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/portal/reports/${baselineAssessment._id}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Previous Report (Run #{baselineAssessment.sequenceNumber})</span>
          </Link>

          <Link
            href={`/portal/reports/${currentAssessment._id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2d523e] hover:bg-[#234232] text-white text-xs font-bold transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Current Report (Run #{currentAssessment.sequenceNumber})</span>
          </Link>

          <button
            onClick={() => setReassessModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-[#d0e2d5] text-[#2d523e] hover:bg-[#f7f9f7] text-xs font-bold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Run Reassessment</span>
          </button>
        </div>
      </div>

      {/* 2. Comparison Header Card */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
              Empirical Reassessment Comparison
            </span>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              DPDP Compliance Delta & Verification Matrix
            </h1>
            <p className="text-xs text-slate-500 font-mono">
              {currentAssessment.targetUrl}
            </p>
          </div>

          {/* Comparison Baseline Selector */}
          {allRuns.length > 2 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Compare with:</span>
              <select
                value={selectedBaselineId}
                onChange={(e) => {
                  setSelectedBaselineId(e.target.value);
                  fetchComparison(e.target.value);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-slate-800 text-xs focus:outline-none focus:border-[#2d523e]"
              >
                {allRuns
                  .filter((r) => String(r._id) !== String(currentAssessment._id))
                  .map((r) => (
                    <option key={r._id} value={r._id}>
                      Run #{r.sequenceNumber || 1} &bull; {new Date(r.createdAt).toLocaleDateString()} ({r.complianceScore}%)
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>

        {/* Side-by-Side Metadata Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Previous Run Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">
                Baseline: Run #{baselineAssessment.sequenceNumber || 1}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {new Date(baselineAssessment.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-extrabold text-slate-800">
                {baselineAssessment.complianceScore !== null && baselineAssessment.complianceScore !== undefined ? `${baselineAssessment.complianceScore}%` : 'Not calculated'}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase">
                {baselineAssessment.status}
              </span>
            </div>
          </div>

          {/* Current Run Card */}
          <div className="p-4 rounded-2xl bg-[#f7f9f7] border border-[#d0e2d5] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#2d523e]">
                Current: Run #{currentAssessment.sequenceNumber || 2}
              </span>
              <span className="text-slate-400 font-mono text-[11px]">
                {new Date(currentAssessment.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-extrabold text-[#2d523e]">
                  {currentAssessment.complianceScore !== null && currentAssessment.complianceScore !== undefined ? `${currentAssessment.complianceScore}%` : 'Not calculated'}
                </span>
                {scoreDelta !== null && scoreDelta !== undefined && scoreDelta !== 0 && (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                      scoreDelta > 0
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {scoreDelta > 0 ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    <span>{scoreDelta > 0 ? `+${scoreDelta}%` : `${scoreDelta}%`}</span>
                  </span>
                )}
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] uppercase">
                {currentAssessment.status}
              </span>
            </div>
          </div>
        </div>

        {/* Scope Difference Notice */}
        {!scopeComparison.isIdenticalScope && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-amber-700" />
              <span>Inspection Scope Difference</span>
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {scopeComparison.explanation} Comparisons should consider this scope variation when interpreting compliance differences.
            </p>
          </div>
        )}

        {/* Findings Delta Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-center">
            <span className="text-xl font-bold text-emerald-800 block">{resolved.length}</span>
            <span className="text-[10px] uppercase font-bold text-emerald-700">Resolved Issues</span>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 text-center">
            <span className="text-xl font-bold text-rose-800 block">{newlyDetected.length}</span>
            <span className="text-[10px] uppercase font-bold text-rose-700">New Issues</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-xl font-bold text-slate-800 block">{persistent.length}</span>
            <span className="text-[10px] uppercase font-bold text-slate-600">Persistent Issues</span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-center">
            <span className="text-xl font-bold text-amber-800 block">{severityChanges.length}</span>
            <span className="text-[10px] uppercase font-bold text-amber-700">Severity Changes</span>
          </div>
        </div>
      </div>

      {/* 3. Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('scenarios')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'scenarios'
              ? 'bg-[#2d523e] text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Statutory Scenarios ({scenarioMatrix.length})
        </button>

        <button
          onClick={() => setActiveTab('resolved')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'resolved'
              ? 'bg-emerald-700 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Resolved ({resolved.length})
        </button>

        <button
          onClick={() => setActiveTab('new')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'new'
              ? 'bg-rose-700 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Newly Detected ({newlyDetected.length})
        </button>

        <button
          onClick={() => setActiveTab('persistent')}
          className={`px-3.5 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'persistent'
              ? 'bg-slate-700 text-white shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          Persistent Unresolved ({persistent.length})
        </button>
      </div>

      {/* 4. Tab Content */}
      {activeTab === 'scenarios' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3">
            {scenarioMatrix.map((sc, idx) => (
              <div
                key={idx}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono uppercase font-semibold text-slate-400">
                      {sc.dpdpReference}
                    </span>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      {sc.title}
                    </h3>
                  </div>

                  <span
                    className={`self-start sm:self-auto text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                      sc.changeType === 'improved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : sc.changeType === 'regressed'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {sc.changeType.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Side-by-side status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {/* Previous State */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-slate-500">Run #{baselineAssessment.sequenceNumber || 1} Status:</span>
                      <span className="font-bold uppercase text-slate-700">{sc.previous.status}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-tight">
                      {sc.previous.summary}
                    </p>
                  </div>

                  {/* Current State */}
                  <div className="p-3 rounded-xl bg-[#f7f9f7] border border-[#d0e2d5] space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-[#2d523e]">Run #{currentAssessment.sequenceNumber || 2} Status:</span>
                      <span
                        className={`font-bold uppercase px-2 py-0.5 rounded-full ${
                          sc.current.status === 'passed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sc.current.status === 'failed'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {sc.current.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-700 leading-tight">
                      {sc.current.summary}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'resolved' && (
        <div className="space-y-3">
          {resolved.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 italic">
              No previous statutory findings have been resolved in this assessment run.
            </div>
          ) : (
            resolved.map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-emerald-50/40 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-emerald-800">
                      {f.ruleId || f.requirementId}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">&bull;</span>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">
                      {f.category}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900">{f.title}</h4>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-100 text-rose-800 line-through">
                    {f.previousStatus}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    Compliant (Pass)
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'new' && (
        <div className="space-y-3">
          {newlyDetected.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 italic">
              No new statutory findings detected in this assessment run.
            </div>
          ) : (
            newlyDetected.map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-rose-50/40 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-rose-800">
                      {f.ruleId || f.requirementId}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">&bull;</span>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">
                      {f.category}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900">{f.title}</h4>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
                    {f.currentStatus} ({f.severity})
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'persistent' && (
        <div className="space-y-3">
          {persistent.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500 italic">
              No persistent unresolved findings.
            </div>
          ) : (
            persistent.map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-slate-700">
                      {f.ruleId || f.requirementId}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">&bull;</span>
                    <span className="text-[10px] uppercase font-semibold text-slate-500">
                      {f.category}
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900">{f.title}</h4>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                    Still Needs Action ({f.currentSeverity})
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Reassessment Modal */}
      <ReassessmentModal
        isOpen={reassessModalOpen}
        onClose={() => setReassessModalOpen(false)}
        assessment={currentAssessment}
        targetUrl={currentAssessment?.targetUrl}
        currentSequence={currentAssessment?.sequenceNumber || 1}
      />
    </div>
  );
}
