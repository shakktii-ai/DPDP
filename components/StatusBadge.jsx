import React from 'react';

const STATUS_CONFIGS = {
  // Assessment statuses
  queued: {
    label: 'Queued',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500'
  },
  in_progress: {
    label: 'In Progress',
    bg: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-sky-500 animate-pulse'
  },
  completed: {
    label: 'Completed',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600'
  },
  failed: {
    label: 'Failed',
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-600'
  },

  // Finding severities
  critical: {
    label: 'Critical',
    bg: 'bg-rose-50 text-rose-800 border-rose-300 font-semibold',
    dot: 'bg-rose-600 animate-ping'
  },
  high: {
    label: 'High',
    bg: 'bg-orange-50 text-orange-800 border-orange-200 font-semibold',
    dot: 'bg-orange-600'
  },
  medium: {
    label: 'Medium',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-600'
  },
  low: {
    label: 'Low',
    bg: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-sky-600'
  },
  informational: {
    label: 'Info',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500'
  },

  // Remediation statuses
  open: {
    label: 'Open Finding',
    bg: 'bg-rose-50 text-rose-800 border-rose-200',
    dot: 'bg-rose-600'
  },
  in_remediation: {
    label: 'In Remediation',
    bg: 'bg-sky-50 text-sky-800 border-sky-200',
    dot: 'bg-sky-600'
  },
  resolved: {
    label: 'Remediated',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600'
  },
  risk_accepted: {
    label: 'Risk Accepted',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500'
  },

  // Authorization statuses
  authorized: {
    label: 'Authorized',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600'
  },
  pending_authorization: {
    label: 'Pending Auth',
    bg: 'bg-amber-50 text-amber-800 border-amber-200',
    dot: 'bg-amber-500'
  },
  active: {
    label: 'Active',
    bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-600'
  }
};

export default function StatusBadge({ status, customLabel, size = 'sm' }) {
  const normalizedKey = status ? String(status).toLowerCase().replace(/-/g, '_') : 'queued';
  const config = STATUS_CONFIGS[normalizedKey] || {
    label: status || 'Unknown',
    bg: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    dot: 'bg-slate-400'
  };

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${config.bg} ${
        sizeClasses[size] || sizeClasses.sm
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      <span>{customLabel || config.label}</span>
    </span>
  );
}
