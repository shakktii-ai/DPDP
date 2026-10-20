import Link from 'next/link';
import { ShieldAlert, PlusCircle, ArrowRight } from 'lucide-react';

export default function EmptyState({
  icon: Icon = ShieldAlert,
  title = 'No Records Found',
  description = 'There are no records currently available in this section.',
  primaryActionText,
  primaryActionHref,
  secondaryActionText,
  secondaryActionHref
}) {
  return (
    <div className="py-12 px-6 rounded-2xl bg-white border border-slate-200 text-center max-w-2xl mx-auto my-6 shadow-xs">
      <div className="w-14 h-14 mx-auto rounded-2xl bg-[#eaf2ed] border border-[#d0e2d5] flex items-center justify-center text-[#2d523e] mb-4">
        <Icon className="w-7 h-7 text-[#2d523e]" />
      </div>

      <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2">
        {title}
      </h3>

      <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-6">
        {description}
      </p>

      {(primaryActionText || secondaryActionText) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {primaryActionHref && primaryActionText && (
            <Link
              href={primaryActionHref}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{primaryActionText}</span>
            </Link>
          )}

          {secondaryActionHref && secondaryActionText && (
            <Link
              href={secondaryActionHref}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-xs transition-all"
            >
              <span>{secondaryActionText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
