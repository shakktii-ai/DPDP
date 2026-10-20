'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  PlaySquare,
  Globe,
  Terminal,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Shield,
  AlertTriangle,
  XCircle,
  Eye,
  Camera,
  FileText,
  UserCheck,
  Send,
  AlertCircle,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

function LiveTestingContent() {
  const searchParams = useSearchParams();
  const initialTargetId = searchParams.get('targetId');
  const initialAssessmentId = searchParams.get('assessmentId');
  const initialRunId = searchParams.get('runId');

  const [targets, setTargets] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState(initialTargetId || '');
  const [activeRunId, setActiveRunId] = useState(initialRunId || null);
  const [runData, setRunData] = useState(null);
  const [scenarioResults, setScenarioResults] = useState([]);
  const [evidenceList, setEvidenceList] = useState([]);
  const [observations, setObservations] = useState([]);
  const [enableComputerUse, setEnableComputerUse] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [triggerOtp, setTriggerOtp] = useState(false);
  const [assistanceInput, setAssistanceInput] = useState('');
  const [isSubmittingAssist, setIsSubmittingAssist] = useState(false);
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'observations' | 'evidence' | 'scenarios' | 'pages'
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);

  const logsEndRef = useRef(null);

  // Load Approved Targets on mount
  useEffect(() => {
    fetch('/api/targets')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.targets) {
          setTargets(data.targets);
          if (!selectedTargetId && data.targets.length > 0) {
            // Default to demo site if available or first target
            const demo = data.targets.find((t) => t.isDemoSite || t.approvedDomain.includes('127.0.0.1') || t.approvedDomain.includes('localhost'));
            setSelectedTargetId(demo ? demo._id : data.targets[0]._id);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Poll active run details every 1.5 seconds if running or awaiting input
  useEffect(() => {
    if (!activeRunId) return;

    let interval = null;

    const fetchRunStatus = async () => {
      try {
        const res = await fetch(`/api/runs/${activeRunId}`);
        const data = await res.json();
        if (data.success) {
          setRunData(data.testRun);
          setScenarioResults(data.scenarioResults || []);
          setEvidenceList(data.evidenceList || []);
          setObservations(data.observations || []);

          // Auto-scroll logs
          if (logsEndRef.current) {
            logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
          }

          // Stop polling once finalized
          const finalStatuses = ['completed', 'failed', 'cancelled'];
          if (finalStatuses.includes(data.testRun.status)) {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Failed to poll test run:', err);
      }
    };

    fetchRunStatus();
    interval = setInterval(fetchRunStatus, 1500);

    return () => clearInterval(interval);
  }, [activeRunId]);

  // Launch Playwright inspection run
  const handleStartInspection = async () => {
    if (!selectedTargetId) {
      alert('Please select an authorized target.');
      return;
    }

    setIsLaunching(true);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: selectedTargetId,
          assessmentId: initialAssessmentId || null,
          options: {
            triggerOtpAssistance: triggerOtp,
            enableComputerUse: enableComputerUse,
            maxPages: 15,
            timeoutSeconds: 120,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActiveRunId(data.testRun._id);
        setRunData(data.testRun);
        setScenarioResults([]);
        setEvidenceList([]);
        setObservations([]);
        setActiveTab('terminal');
      } else {
        alert(`Failed to start run: ${data.error}`);
      }
    } catch (err) {
      alert(`Error launching inspection: ${err.message}`);
    } finally {
      setIsLaunching(false);
    }
  };

  // Quick 1-click launch for local synthetic demo site
  const handleLaunchDemoSite = async () => {
    setIsLaunching(true);
    try {
      // Find or create local demo target
      let demoTarget = targets.find((t) => t.isDemoSite || t.targetUrl.includes('4005'));
      if (!demoTarget) {
        // Create demo target via /api/targets
        const targetRes = await fetch('/api/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUrl: 'http://127.0.0.1:4005',
            approvedDomain: '127.0.0.1:4005',
            approvedScope: ['public_pages', 'privacy_policy', 'grievance_contact_verification', 'cookie_consent_banners'],
            authorizationConfirmation: {
              confirmed: true,
              confirmedByName: 'DPDP Security Auditor',
              confirmedByDesignation: 'System Evaluator',
            },
            isDemoSite: true,
          }),
        });
        const targetData = await targetRes.json();
        if (targetData.success) {
          demoTarget = targetData.target;
          setTargets((prev) => [targetData.target, ...prev]);
          setSelectedTargetId(demoTarget._id);
        }
      }

      if (demoTarget) {
        setSelectedTargetId(demoTarget._id);
        const res = await fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetId: demoTarget._id,
            options: {
              triggerOtpAssistance: triggerOtp,
              enableComputerUse: enableComputerUse,
              maxPages: 15,
              timeoutSeconds: 120,
            },
          }),
        });
        const data = await res.json();
        if (data.success) {
          setActiveRunId(data.testRun._id);
          setRunData(data.testRun);
          setScenarioResults([]);
          setEvidenceList([]);
          setObservations([]);
          setActiveTab('terminal');
        }
      }
    } catch (err) {
      alert(`Error launching demo inspection: ${err.message}`);
    } finally {
      setIsLaunching(false);
    }
  };

  // Cancel running inspection
  const handleCancelRun = async () => {
    if (!activeRunId) return;
    try {
      const res = await fetch(`/api/runs/${activeRunId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = await res.json();
      if (data.success) {
        setRunData(data.testRun);
      }
    } catch (err) {
      alert(`Failed to cancel run: ${err.message}`);
    }
  };

  // Submit assistance when awaiting input
  const handleSubmitAssistance = async () => {
    if (!activeRunId) return;
    setIsSubmittingAssist(true);
    try {
      const res = await fetch(`/api/runs/${activeRunId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_assistance',
          assistanceData: { input: assistanceInput, submittedAt: new Date() },
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRunData(data.testRun);
        setAssistanceInput('');
      }
    } catch (err) {
      alert(`Failed to submit assistance: ${err.message}`);
    } finally {
      setIsSubmittingAssist(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-emerald-800 bg-emerald-50 border-emerald-200';
      case 'inspecting_website':
      case 'starting_browser':
      case 'capturing_evidence': return 'text-sky-800 bg-sky-50 border-sky-200';
      case 'awaiting_user_input': return 'text-amber-800 bg-amber-50 border-amber-200';
      case 'failed': return 'text-rose-800 bg-rose-50 border-rose-200';
      case 'cancelled': return 'text-slate-700 bg-slate-100 border-slate-200';
      default: return 'text-slate-700 bg-slate-100 border-slate-200';
    }
  };

  const selectedTargetObj = targets.find((t) => t._id === selectedTargetId);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <PlaySquare className="w-5 h-5 text-[#2d523e]" />
            <span>Playwright Website Inspection & Evidence Engine</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Automated Chromium browser worker executing DPDP Act 2023 compliance scenarios on authorized targets.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleLaunchDemoSite}
            disabled={isLaunching || (runData && ['starting_browser', 'inspecting_website', 'capturing_evidence'].includes(runData.status))}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all disabled:opacity-50"
            title="Inspect local synthetic demo portal on port 4005"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>Launch Authorized Demo Portal (Port 4005)</span>
          </button>
        </div>
      </div>

      {/* Target & Options Control Card */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Target Selector */}
          <div className="md:col-span-5">
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">
              Select Approved Target
            </label>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono focus:border-emerald-600 focus:outline-none shadow-xs"
            >
              {targets.length === 0 ? (
                <option value="">No approved targets found. Use demo portal button.</option>
              ) : (
                targets.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.approvedDomain} ({t.targetUrl}) {t.isDemoSite ? '— [DEMO]' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Options Toggles */}
          <div className="md:col-span-4 flex flex-col gap-1.5 mt-2 md:mt-0">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={enableComputerUse}
                onChange={(e) => setEnableComputerUse(e.target.checked)}
                className="rounded border-slate-300 text-[#2d523e] focus:ring-[#2d523e]"
              />
              <span className="text-[#2d523e] font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#2d523e]" />
                <span>Autonomous Gemini Computer Use</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-500">
              <input
                type="checkbox"
                checked={triggerOtp}
                onChange={(e) => setTriggerOtp(e.target.checked)}
                className="rounded border-slate-300 text-[#2d523e] focus:ring-[#2d523e]"
              />
              <span>Simulate OTP / CAPTCHA Assistance Pause</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="md:col-span-3 flex items-center justify-end gap-2">
            {runData && ['starting_browser', 'inspecting_website', 'capturing_evidence', 'awaiting_user_input'].includes(runData.status) ? (
              <button
                onClick={handleCancelRun}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-all"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Cancel Run</span>
              </button>
            ) : (
              <button
                onClick={handleStartInspection}
                disabled={isLaunching || !selectedTargetId}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Launch Browser Inspection</span>
              </button>
            )}
          </div>
        </div>

        {/* Selected Target Security Banner */}
        {selectedTargetObj && (
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
            <div className="flex items-center gap-2 font-mono">
              <Shield className="w-3.5 h-3.5 text-[#2d523e]" />
              <span>Target: {selectedTargetObj.targetUrl}</span>
              <span className="text-slate-300">&bull;</span>
              <span className="text-emerald-700 font-semibold">Status: {selectedTargetObj.targetStatus}</span>
              {selectedTargetObj.isDemoSite && (
                <span className="px-1.5 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] text-[10px] font-semibold">
                  Local Authorized Demo
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500">
              SSRF Protection: Active &bull; Worker Isolation: Sandboxed Context
            </div>
          </div>
        )}
      </div>

      {/* Human Assistance Banner when awaiting_user_input */}
      {runData && runData.status === 'awaiting_user_input' && (
        <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Human Verification Required</span>
          </div>
          <p className="text-xs text-amber-800">
            {runData.userAssistancePrompt || 'Simulated OTP or CAPTCHA detected on test login page. Please provide assistance to resume.'}
          </p>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={assistanceInput}
              onChange={(e) => setAssistanceInput(e.target.value)}
              placeholder="e.g. 123456 (Simulated OTP)"
              className="px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-slate-900 font-mono focus:outline-none shadow-xs"
            />
            <button
              onClick={handleSubmitAssistance}
              disabled={isSubmittingAssist}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white transition-all disabled:opacity-50 shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Submit & Resume Execution</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Run Progress Status Card */}
      {runData && (
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border uppercase tracking-wide ${getStatusColor(runData.status)}`}>
                {runData.status.replace(/_/g, ' ')}
              </span>
              <span className="text-slate-900 font-semibold">{runData.currentStep}</span>
            </div>
            <div className="flex items-center gap-4 text-slate-500 text-xs font-mono">
              <span>Pages Visited: <strong className="text-slate-900">{runData.pagesVisited?.length || 0}</strong></span>
              <span>Evidence Items: <strong className="text-emerald-700">{runData.evidenceCount || 0}</strong></span>
              <span>Progress: <strong className="text-[#2d523e]">{runData.progress}%</strong></span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div
              className="h-full bg-[#2d523e] transition-all duration-300"
              style={{ width: `${runData.progress}%` }}
            />
          </div>

          {runData.errorMessage && (
            <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{runData.errorMessage}</span>
            </div>
          )}
        </div>
      )}

      {/* Tabs for Run Inspection */}
      {runData && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
            <button
              onClick={() => setActiveTab('terminal')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'terminal' ? 'bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Live Console Stream ({runData.logs?.length || 0})</span>
            </button>
            <button
              onClick={() => setActiveTab('observations')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'observations' ? 'bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2d523e]" />
              <span>AI Observations ({observations.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('scenarios')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'scenarios' ? 'bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Scenario Results ({scenarioResults.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('evidence')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'evidence' ? 'bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Captured Evidence ({evidenceList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('pages')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'pages' ? 'bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Visited URLs ({runData.pagesVisited?.length || 0})</span>
            </button>
          </div>

          {/* Tab 1: Terminal Log Stream */}
          {activeTab === 'terminal' && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs flex flex-col h-[400px] shadow-sm">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 mb-2 text-slate-400 text-[11px]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Execution Telemetry Stream</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              </div>
              <div ref={logsEndRef} className="flex-1 overflow-y-auto space-y-1.5 text-slate-300 text-xs pr-2">
                {runData.logs && runData.logs.length > 0 ? (
                  runData.logs.map((log, index) => (
                    <div key={index} className="leading-relaxed">
                      <span className="text-slate-500 font-mono">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                      <span
                        className={`font-semibold uppercase text-[10px] px-1 rounded ${
                          log.level === 'error'
                            ? 'text-rose-400 bg-rose-500/10'
                            : log.level === 'warn'
                            ? 'text-amber-400 bg-amber-500/10'
                            : 'text-cyan-400 bg-cyan-500/10'
                        }`}
                      >
                        {log.level}
                      </span>{' '}
                      <span className="text-slate-300">{log.message}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">No logs recorded yet.</div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Gemini Computer Use Observations */}
          {activeTab === 'observations' && (
            <div className="space-y-3">
              {observations.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 bg-white rounded-xl">
                  No autonomous Gemini observations recorded yet. They will appear here when Computer Use is enabled during inspection.
                </div>
              ) : (
                observations.map((obs) => (
                  <div key={obs._id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-[#2d523e] bg-[#eaf2ed] px-2 py-0.5 rounded border border-[#d0e2d5]">
                            {obs.scenarioId}
                          </span>
                          <span className="text-xs font-bold text-slate-900 uppercase">{obs.actionTaken?.action || 'Action'}</span>
                          {obs.actionTaken?.modelUsed && (
                            <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              {obs.actionTaken.modelUsed}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-800 font-semibold">{obs.observedUiElement || 'UI Element Target'}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{obs.pageUrl}</p>
                      </div>

                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {obs.confidence || 'high'} confidence
                      </span>
                    </div>

                    <div className="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-500">Execution Result: </span>
                        <span className="text-[#2d523e] font-semibold">{obs.result}</span>
                      </div>
                      {obs.actionTaken?.coordinates && (
                        <div className="text-[11px] text-slate-500">
                          Coordinates: ({obs.actionTaken.coordinates.x}px, {obs.actionTaken.coordinates.y}px)
                        </div>
                      )}
                    </div>

                    {obs.screenshotReference && (
                      <div
                        className="w-48 aspect-video bg-slate-100 rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => setSelectedScreenshot(obs.screenshotReference)}
                      >
                        <img src={obs.screenshotReference} alt="Observation Screenshot" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Scenario Results */}
          {activeTab === 'scenarios' && (
            <div className="space-y-3">
              {scenarioResults.length === 0 ? (
                <div className="p-8 text-center text-slate-500 border border-dashed border-slate-200 bg-white rounded-xl">
                  No scenarios evaluated yet. They will appear here as pages are inspected.
                </div>
              ) : (
                scenarioResults.map((s) => (
                  <div key={s._id} className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        {s.status === 'passed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : s.status === 'failed' ? (
                          <XCircle className="w-4 h-4 text-rose-600" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                        )}
                        <span>{s.title}</span>
                      </h4>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          s.status === 'passed'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : s.status === 'failed'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {s.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">{s.summary}</p>
                    <p className="text-[11px] text-[#2d523e] font-mono font-medium">Reference: {s.dpdpReference}</p>
                    {s.observedFindings && s.observedFindings.length > 0 && (
                      <ul className="text-xs text-slate-600 list-disc list-inside space-y-0.5 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        {s.observedFindings.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Captured Evidence Gallery */}
          {activeTab === 'evidence' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {evidenceList.length === 0 ? (
                <div className="col-span-full p-8 text-center text-slate-500 border border-dashed border-slate-200 bg-white rounded-xl">
                  No evidence screenshots captured yet.
                </div>
              ) : (
                evidenceList.map((ev) => (
                  <div key={ev._id} className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2">
                    <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 relative group">
                      {ev.screenshotPath ? (
                        <img
                          src={ev.screenshotPath}
                          alt={ev.pageTitle || ev.scenarioId}
                          className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => setSelectedScreenshot(ev.screenshotPath)}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400">
                          <Camera className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-slate-900/80 text-[10px] font-mono text-white">
                        {ev.scenarioId}
                      </div>
                    </div>
                    <div>
                      <h5 className="text-xs font-semibold text-slate-900 truncate">{ev.pageTitle || 'Inspected Page'}</h5>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{ev.pageUrl}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 4: Visited Pages List */}
          {activeTab === 'pages' && (
            <div className="rounded-xl bg-white border border-slate-200 shadow-xs p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Sanitized URLs Discovered & Inspected
              </h4>
              <div className="space-y-2">
                {runData.pagesVisited && runData.pagesVisited.length > 0 ? (
                  runData.pagesVisited.map((p, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Globe className="w-3.5 h-3.5 text-[#2d523e]" />
                        <span className="text-slate-900">{p.url}</span>
                        {p.title && <span className="text-slate-500 font-sans">({p.title})</span>}
                      </div>
                      <span className="text-emerald-700 font-bold">HTTP {p.statusCode || 200}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs italic">No pages recorded yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Screenshot Lightbox Modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="max-w-4xl w-full bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl p-2">
            <img src={selectedScreenshot} alt="Evidence Screenshot" className="w-full h-auto rounded-lg" />
            <div className="p-3 text-right">
              <button
                onClick={() => setSelectedScreenshot(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold border border-slate-200"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LiveTestingPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-slate-500">
          <div className="w-8 h-8 mx-auto border-2 border-[#2d523e] border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs">Connecting to Playwright Inspection Engine...</p>
        </div>
      }
    >
      <LiveTestingContent />
    </Suspense>
  );
}
