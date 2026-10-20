'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileCheck2,
  PlusCircle,
  ExternalLink,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
  RefreshCw
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';

export default function AssessmentsPage() {
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const loadAssessments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/assessments');
      const json = await res.json();
      if (json.success) {
        setAssessments(json.data || []);
      }
    } catch (e) {
      console.error('Failed to load assessments:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssessments();
  }, []);

  const filtered = assessments.filter((a) => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Website Compliance Assessments
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Audit history, AI-assisted vision evaluations, and real-time consent verification records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAssessments}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 shadow-xs"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/assessments/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Assessment</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs">
        {['all', 'queued', 'in_progress', 'completed', 'failed'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-all ${
              filter === tab
                ? 'bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title={filter === 'all' ? 'No Assessments Conducted' : `No ${filter} assessments`}
          description="Initiate an automated assessment to evaluate your website against Section 6 (Consent Notice) and Section 7 of the DPDP Act 2023."
          primaryActionText="Create First Assessment"
          primaryActionHref="/assessments/new"
          secondaryActionText="Register Organization"
          secondaryActionHref="/organizations"
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-4">Target Website</th>
                  <th className="p-4">Organization</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">AI Model</th>
                  <th className="p-4">Compliance Score</th>
                  <th className="p-4">Created</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filtered.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-medium text-slate-900">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-xs">{item.targetUrl}</span>
                          <a
                            href={item.targetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 hover:text-slate-600"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            Run #{item.sequenceNumber || 1}
                          </span>
                          {item.isReassessment && (
                            <span className="font-semibold px-1.5 py-0.2 rounded bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
                              Reassessment
                            </span>
                          )}
                          {item.previousAssessmentId && (
                            <Link
                              href={`/testing?id=${item.previousAssessmentId._id || item.previousAssessmentId}`}
                              className="text-slate-500 hover:text-[#2d523e] underline"
                              title="Jump to previous assessment run"
                            >
                              Prior Run (#{item.previousAssessmentId?.sequenceNumber || '1'})
                            </Link>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600">
                      {item.organization?.name || 'N/A'}
                    </td>
                    <td className="p-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        <Sparkles className="w-3 h-3 text-slate-500" />
                        {item.modelUsed || 'gemini-3.8-flash'}
                      </span>
                    </td>
                    <td className="p-4">
                      {item.complianceScore !== null && item.complianceScore !== undefined ? (
                        <span className="font-bold text-emerald-700">
                          {item.complianceScore}%
                        </span>
                      ) : (
                        <span className="text-slate-400">&mdash;</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-500">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.isReassessment && (
                          <Link
                            href={`/portal/assessments/${item._id}/compare`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                            title="Compare with previous run"
                          >
                            <span>Compare</span>
                          </Link>
                        )}
                        <Link
                          href={`/testing?id=${item._id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#2d523e] hover:text-emerald-900"
                        >
                          <span>Console</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
