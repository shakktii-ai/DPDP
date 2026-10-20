'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Globe,
  FileCheck2,
  Clock,
  AlertTriangle,
  FileText,
  PlusCircle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Wrench,
  Scale
} from 'lucide-react';
import StatCard from '@/components/StatCard';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/stats');
      const json = await res.json();
      if (json.success) {
        setStats(json.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const metrics = stats?.metrics || {
    organizations: 0,
    websites: 0,
    assessmentsCompleted: 0,
    assessmentsInProgress: 0,
    openFindings: 0,
    reportsGenerated: 0
  };

  const isEmpty = stats?.isEmpty ?? true;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
              Admin Console
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs text-slate-500">DPDP Act 2023 & Rules 2025</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            Internal Operations Dashboard
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Real-time compliance monitoring, automated crawler fleet operations, and statutory finding repository.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={loadStats}
            disabled={refreshing}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 shadow-xs transition-all focus:outline-none"
            title="Refresh metrics"
            id="refresh-admin-metrics-btn"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/portal"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs transition-all"
          >
            <Globe className="w-3.5 h-3.5 text-[#2d523e]" />
            <span>Customer Portal</span>
          </Link>
          <Link
            href="/assessments/new"
            id="new-assessment-admin-btn"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Assessment</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Organizations"
          value={metrics.organizations}
          icon={Building2}
          variant="cyan"
          subtext="Data Fiduciaries"
        />
        <StatCard
          title="Approved Targets"
          value={metrics.websites}
          icon={Globe}
          variant="indigo"
          subtext="Validated Domains"
        />
        <StatCard
          title="In Progress"
          value={metrics.assessmentsInProgress}
          icon={Clock}
          variant="amber"
          subtext="Live Playwright"
        />
        <StatCard
          title="Completed"
          value={metrics.assessmentsCompleted}
          icon={FileCheck2}
          variant="emerald"
          subtext="Audit Finished"
        />
        <StatCard
          title="Statutory Findings"
          value={metrics.openFindings}
          icon={AlertTriangle}
          variant="rose"
          subtext="Violations & Reviews"
        />
        <StatCard
          title="Audit Reports"
          value={metrics.reportsGenerated}
          icon={FileText}
          variant="default"
          subtext="PDF & Excel"
        />
      </div>

      {/* Main Content Area */}
      {isEmpty && !loading ? (
        <EmptyState
          icon={Sparkles}
          title="No Organizations or Assessments Yet"
          description="Your platform database is connected and initialized. Get started by registering your organization and configuring an approved website domain."
          primaryActionText="Start Onboarding Wizard"
          primaryActionHref="/onboarding"
          secondaryActionText="Configure Targets Manually"
          secondaryActionHref="/targets"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Assessments Feed (2 Cols) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between pb-1">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#2d523e]" />
                <span>Recent Website Assessments</span>
              </h2>
              <Link
                href="/assessments"
                className="text-xs font-semibold text-[#2d523e] hover:text-emerald-900 flex items-center gap-1 group"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="space-y-3">
              {stats?.recentAssessments?.length > 0 ? (
                stats.recentAssessments.map((item) => (
                  <div
                    key={item._id}
                    className="p-4 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-xs hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm group-hover:text-[#2d523e] transition-colors">
                          {item.websiteName || item.targetUrl}
                        </span>
                        <StatusBadge status={item.status} size="sm" />
                      </div>
                      <p className="text-xs text-slate-500 font-mono truncate max-w-md">
                        {item.targetUrl}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      {item.complianceScore !== null && item.complianceScore !== undefined && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Score</span>
                          <span
                            className={`font-bold text-sm ${
                              item.complianceScore >= 80
                                ? 'text-emerald-700'
                                : item.complianceScore >= 50
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {item.complianceScore}%
                          </span>
                        </div>
                      )}
                      <Link
                        href={`/assessments`}
                        className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 rounded-xl bg-white border border-slate-200 text-center text-xs text-slate-500 shadow-xs">
                  No assessments executed yet. Run an assessment to see real-time findings.
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & System Info (1 Col) */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-1">
              <Scale className="w-4 h-4 text-[#2d523e]" />
              <span>Admin Operations</span>
            </h2>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
              <Link
                href="/testing"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-[#2d523e]" />
                  <span>Inspection Studio (Playwright)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 transition-colors" />
              </Link>

              <Link
                href="/findings"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Review Statutory Findings</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 transition-colors" />
              </Link>

              <Link
                href="/remediation"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <Wrench className="w-4 h-4 text-[#2d523e]" />
                  <span>Remediation Action Tracker</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 transition-colors" />
              </Link>

              <Link
                href="/reports"
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-slate-700" />
                  <span>Generate Audit Reports (PDF/Excel)</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-800 transition-colors" />
              </Link>
            </div>

            {/* Statutory Standard Card */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <span className="font-semibold text-slate-800 block">Enforced Legal Standards</span>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Evaluates Section 5 (Notice), Section 6 (Consent & Withdrawal), Section 8(5) (Safeguards), Section 8(9) (Grievance Officer), and DPDP Rules 2025 multi-lingual formats.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
