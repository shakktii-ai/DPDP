import React from 'react';

export default function StatCard({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'default',
  loading = false
}) {
  const variantStyles = {
    default: {
      border: 'border-slate-200 hover:border-slate-300',
      iconBg: 'bg-slate-100 text-slate-700 border border-slate-200',
      glow: 'hover:shadow-slate-200'
    },
    emerald: {
      border: 'border-emerald-200 hover:border-emerald-300',
      iconBg: 'bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]',
      glow: 'hover:shadow-emerald-100'
    },
    cyan: {
      border: 'border-sky-200 hover:border-sky-300',
      iconBg: 'bg-sky-50 text-sky-700 border border-sky-200',
      glow: 'hover:shadow-sky-100'
    },
    amber: {
      border: 'border-amber-200 hover:border-amber-300',
      iconBg: 'bg-amber-50 text-amber-700 border border-amber-200',
      glow: 'hover:shadow-amber-100'
    },
    indigo: {
      border: 'border-indigo-200 hover:border-indigo-300',
      iconBg: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      glow: 'hover:shadow-indigo-100'
    },
    rose: {
      border: 'border-rose-200 hover:border-rose-300',
      iconBg: 'bg-rose-50 text-rose-700 border border-rose-200',
      glow: 'hover:shadow-rose-100'
    }
  };

  const style = variantStyles[variant] || variantStyles.default;

  return (
    <div
      className={`relative p-5 rounded-xl bg-white border transition-all duration-200 shadow-xs hover:shadow-md ${style.border} ${style.glow}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </p>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${style.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="h-8 w-20 bg-slate-100 animate-pulse rounded my-1" />
        ) : (
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {value}
          </div>
        )}

        {subtext && (
          <p className="mt-1 text-xs text-slate-500 font-medium">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
