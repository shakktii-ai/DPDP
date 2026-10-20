'use client';

import { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  Sparkles,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ExternalLink
} from 'lucide-react';

export default function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [testModelName, setTestModelName] = useState('gemini-3.8-flash');
  const [testingModel, setTestingModel] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);

  const fetchHealth = async () => {
    try {
      setLoadingHealth(true);
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealth(data);
    } catch (e) {
      console.error('Failed to fetch health:', e);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const handleTestModel = async () => {
    try {
      setTestingModel(true);
      setVerificationResult(null);
      const res = await fetch(`/api/gemini/verify?model=${encodeURIComponent(testModelName)}`);
      const data = await res.json();
      setVerificationResult(data.capabilities);
    } catch (err) {
      setVerificationResult({
        status: 'error',
        message: err.message
      });
    } finally {
      setTestingModel(false);
    }
  };

  const db = health?.services?.database;
  const ai = health?.services?.aiEngine;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-500" />
          <span>Platform Settings & System Status</span>
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Review database connectivity, verify Gemini model provisioning, and check compliance thresholds.
        </p>
      </div>

      {/* Database Connection Panel */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-[#2d523e]" />
            <span>MongoDB Connection Status</span>
          </h3>
          <button
            onClick={fetchHealth}
            disabled={loadingHealth}
            className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
            <span>Check Status</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 block">Connection State</span>
            <span className="font-semibold text-slate-900 capitalize flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  db?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              {db?.state || 'Checking...'}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 block">Target Database</span>
            <span className="font-semibold text-slate-900 font-mono">
              {db?.databaseName || 'dpdp_assessment'}
            </span>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-slate-500 block">Caching Strategy</span>
            <span className="font-semibold text-[#2d523e]">
              Cached Mongoose Singleton
            </span>
          </div>
        </div>

        {db?.notice && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            {db.notice}
          </div>
        )}
      </div>

      {/* Gemini AI Engine Configuration Panel */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#2d523e]" />
          <span>Google Gemini API & Computer Use Model Engine</span>
        </h3>

        <div className="p-3.5 rounded-lg bg-[#eaf2ed] border border-[#d0e2d5] text-xs text-[#2d523e] space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Zero Client-Side Exposure Architecture</span>
          </div>
          <p className="text-slate-700 leading-relaxed text-[11px]">
            The <code className="bg-white/80 px-1 py-0.5 rounded text-slate-900 font-mono">GEMINI_API_KEY</code> is executed strictly server-side
            in secure Node.js API handlers. No secrets are ever exposed through client bundles or
            <code className="bg-white/80 px-1 py-0.5 rounded text-slate-900 font-mono"> NEXT_PUBLIC</code> environment variables.
          </p>
        </div>

        {/* Dynamic Model Test & Probe */}
        <div className="space-y-3 pt-2">
          <label className="block text-xs font-medium text-slate-700">
            Verify Model Provisioning & Capability
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={testModelName}
              onChange={(e) => setTestModelName(e.target.value)}
              placeholder="gemini-3.8-flash"
              className="flex-1 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono text-xs focus:border-[#2d523e] focus:outline-none"
            />
            <button
              onClick={handleTestModel}
              disabled={testingModel}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234131] text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingModel ? 'animate-spin' : ''}`} />
              <span>{testingModel ? 'Testing...' : 'Test Availability'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Tests whether the model ID is active in the configured Google Project. Automatically probes
            safe fallback models if unavailable.
          </p>

          {/* Test Output */}
          {verificationResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                verificationResult.status === 'available' || verificationResult.status === 'fallback_available'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}
            >
              <div className="font-semibold flex items-center gap-2">
                {verificationResult.status === 'available' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                )}
                <span>Verification Result: {verificationResult.status}</span>
              </div>
              <p className="text-slate-700">{verificationResult.message}</p>
              <div className="flex flex-wrap gap-4 text-[11px] text-slate-600 pt-1">
                <span>
                  Active Model: <strong className="text-slate-900 font-mono">{verificationResult.activeModel || 'None'}</strong>
                </span>
                <span>
                  Computer Use Flag: <strong className="text-slate-900">{verificationResult.computerUseSupported ? 'Yes' : 'No'}</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DPDP Legal Compliance Thresholds */}
      <div className="p-6 rounded-xl bg-white border border-slate-200 space-y-4 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#2d523e]" />
          <span>Statutory DPDP Act 2023 Rules Reference</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-semibold text-slate-900">Section 6(1) &mdash; Notice Mandate</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Data Fiduciary must accompany or precede request for consent with an itemized notice stating
              personal data collected and purpose of processing.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-semibold text-slate-900">Section 6(3) &mdash; Multilingual Access</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Data Principal must have the option to access the notice and consent request in English or
              any language specified in the Eighth Schedule to the Constitution.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-semibold text-slate-900">Section 7(4) &mdash; Consent Withdrawal</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Ease of withdrawing consent must be comparable to the ease with which consent was given.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <span className="font-semibold text-slate-900">Section 8(9) &mdash; Grievance Officer</span>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Data Fiduciary must publish business contact details of the Data Protection Officer or
              person authorized to respond to grievances.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
