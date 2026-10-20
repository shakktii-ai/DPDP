'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RotateCcw,
  Globe,
  Shield,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  ArrowRight,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

export default function ReassessmentModal({
  isOpen,
  onClose,
  assessment,
  targetUrl,
  websiteName,
  currentSequence = 1,
  isRetry = false,
}) {
  const router = useRouter();

  const [scopeMode, setScopeMode] = useState('public_only'); // 'public_only' or 'authenticated'
  const [testLoginUrl, setTestLoginUrl] = useState('');
  const [testUsername, setTestUsername] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authConfirmed, setAuthConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const nextSequence = currentSequence + 1;
  const assessmentId = assessment?._id || assessment?.assessmentId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (scopeMode === 'authenticated') {
      if (!testLoginUrl.trim()) {
        setError('Login page URL is required for authenticated testing.');
        return;
      }
      if (!testUsername.trim() || !testPassword) {
        setError('Both test account username/email and password are required.');
        return;
      }
      if (!authConfirmed) {
        setError('Please confirm that you authorize automated testing with these credentials.');
        return;
      }
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/assessments/${assessmentId}/reassess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeConfig: {
            skipAuthenticatedTesting: scopeMode === 'public_only',
            testLoginUrl: scopeMode === 'authenticated' ? testLoginUrl.trim() : null,
            testUsername: scopeMode === 'authenticated' ? testUsername.trim() : null,
            testPassword: scopeMode === 'authenticated' ? testPassword : null,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to initiate reassessment.');
      }

      onClose();
      // Redirect to the new live assessment monitoring page
      router.push(`/portal/assessments/${data.assessmentId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full bg-white rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] flex items-center justify-center flex-shrink-0">
              <RotateCcw className="w-5 h-5 text-[#2d523e]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isRetry ? 'Retry Assessment' : 'Run Website Reassessment'}
              </h3>
              <p className="text-xs text-slate-500">
                {isRetry ? 'Restart this assessment run cleanly' : `Creating fresh Assessment Run #${nextSequence}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Audit Preservation Notice */}
        <div className="p-3.5 rounded-2xl bg-[#f7f9f7] border border-[#d0e2d5] text-xs text-[#2d523e] space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#2d523e]" />
            <span>Audit Trail & Previous Report Preserved</span>
          </div>
          <p className="text-[11px] text-[#2d523e]/90 leading-relaxed">
            Your previous assessment (Run #{currentSequence}) and its official compliance findings will remain permanently intact and accessible in your workspace history for DPDP regulatory records.
          </p>
        </div>

        {/* Target Website Info */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Target Website
          </label>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs text-slate-800 font-mono">
            <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="truncate">{targetUrl || assessment?.targetUrl}</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Reassessment Scope Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>Inspection Scope Configuration</span>
            </label>

            <div className="grid grid-cols-1 gap-2 text-xs">
              {/* Option 1: Public Pages Only */}
              <label
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  scopeMode === 'public_only'
                    ? 'bg-[#eaf2ed]/40 border-[#2d523e] text-slate-900 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="scopeMode"
                  value="public_only"
                  checked={scopeMode === 'public_only'}
                  onChange={() => setScopeMode('public_only')}
                  className="mt-0.5 text-[#2d523e] focus:ring-[#2d523e]"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">
                    Public Pages Only (Recommended)
                  </span>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Evaluates cookie banners, privacy disclosures, grievance redressal officer details, and interactive contact forms without logging in.
                  </p>
                </div>
              </label>

              {/* Option 2: Authenticated Flow */}
              <label
                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                  scopeMode === 'authenticated'
                    ? 'bg-[#eaf2ed]/40 border-[#2d523e] text-slate-900 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                }`}
              >
                <input
                  type="radio"
                  name="scopeMode"
                  value="authenticated"
                  checked={scopeMode === 'authenticated'}
                  onChange={() => setScopeMode('authenticated')}
                  className="mt-0.5 text-[#2d523e] focus:ring-[#2d523e]"
                />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-900 block">
                    Include Authenticated Member Pages
                  </span>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Tests test account login safeguards (Sec 8(5)) and authenticated user rights portals using dedicated test credentials.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Conditional Test Account Credentials */}
          {scopeMode === 'authenticated' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-700">
                  Login Page URL <span className="text-rose-600">*</span>
                </label>
                <input
                  type="url"
                  value={testLoginUrl}
                  onChange={(e) => setTestLoginUrl(e.target.value)}
                  placeholder="https://example.com/login"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-[#2d523e]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Test Username / Email <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={testUsername}
                    onChange={(e) => setTestUsername(e.target.value)}
                    placeholder="dpdp-test@example.com"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-[#2d523e]"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Test Password <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={testPassword}
                      onChange={(e) => setTestPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 pr-8 rounded-xl bg-white border border-slate-200 text-xs focus:outline-none focus:border-[#2d523e]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-2 pt-1 text-[11px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={authConfirmed}
                  onChange={(e) => setAuthConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-[#2d523e] focus:ring-[#2d523e]"
                />
                <span>
                  I confirm that these are test credentials authorized for automated DPDP statutory evaluation.
                </span>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              id="confirm-reassessment-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>
                {loading
                  ? 'Initializing Assessment...'
                  : isRetry
                  ? 'Retry Assessment Now'
                  : `Start Reassessment (Run #${nextSequence})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
