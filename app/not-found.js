import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-4 shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Page Not Found
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          The requested DPDP platform section or resource does not exist or has been relocated.
        </p>
        <div className="pt-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
