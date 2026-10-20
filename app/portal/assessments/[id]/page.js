'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Globe,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Maximize2,
  RefreshCw,
  Lock,
  Pause,
  Play,
  X,
  FileText,
  Camera,
  Activity,
  Layers,
  Sparkles,
  AlertCircle,
  Eye,
  Sliders,
  Check,
  RotateCcw,
  Scale
} from 'lucide-react';
import ReassessmentModal from '@/components/ReassessmentModal';

const MILESTONES = [
  { id: 1, title: 'Authorized Domain Verification', desc: 'Validating SSL, domain authorization, and SSRF boundary.', minPct: 10 },
  { id: 2, title: 'Consent Notice & Cookie Banner', desc: 'Inspecting landing page for Sec 5 & 6 opt-in/opt-out mechanisms.', minPct: 25 },
  { id: 3, title: 'Privacy Notice Disclosures', desc: 'Examining /privacy for itemized statutory disclosures under Sec 5.', minPct: 40 },
  { id: 4, title: 'Grievance Redressal & DPO', desc: 'Verifying Data Protection Officer contact details and escalation SLA.', minPct: 55 },
  { id: 5, title: 'Data Minimization on Forms', desc: 'Scanning interactive contact forms for purpose consent checkboxes.', minPct: 70 },
  { id: 6, title: 'Consent Withdrawal & Rights', desc: 'Verifying granular purpose toggles and unconditional withdrawal portal.', minPct: 85 },
  { id: 7, title: 'Authentication Safeguards (Sec 8(5))', desc: 'Evaluating test account authentication safeguards or public-scope boundary.', minPct: 92 },
];

export default function CustomerLiveTestingPage({ params }) {
  const unwrappedParams = use(params);
  const assessmentId = unwrappedParams.id;
  const router = useRouter();

  const [assessment, setAssessment] = useState(null);
  const [testRun, setTestRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [evidenceList, setEvidenceList] = useState([]);
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [streamConnected, setStreamConnected] = useState(false);
  const [latestScreenshot, setLatestScreenshot] = useState(null);
  const [latestScreenshotUrl, setLatestScreenshotUrl] = useState('');
  const [latestScreenshotTime, setLatestScreenshotTime] = useState(null);
  const [selectedImageModal, setSelectedImageModal] = useState(null);
  const [imgErrors, setImgErrors] = useState({});
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [reassessModalOpen, setReassessModalOpen] = useState(false);
  const [isRetryMode, setIsRetryMode] = useState(false);

  const eventSourceRef = useRef(null);
  const isMountedRef = useRef(true);

  // Fetch snapshot of assessment and test run from database
  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/api/assessments/${assessmentId}/stream`, {
        headers: { Accept: 'application/json' },
      });
      const json = await res.json();
      if (json.success && isMountedRef.current) {
        setAssessment(json.assessment || null);
        setTestRun(json.testRun || null);
        setEvents(json.events || []);
        setEvidenceList(json.evidenceList || []);
        setScenarios(json.scenarios || []);
        if (json.testRun?.latestScreenshot) {
          setLatestScreenshot(json.testRun.latestScreenshot);
          setLatestScreenshotUrl(json.testRun.latestScreenshotUrl || json.testRun.currentUrl || '');
          setLatestScreenshotTime(json.testRun.latestScreenshotTime || new Date());
        }
        setLoading(false);
      }
    } catch (pollErr) {
      console.error('Polling error:', pollErr);
    }
  }, [assessmentId]);

  // Initialize and connect live event stream
  useEffect(() => {
    let isMounted = true;
    isMountedRef.current = true;
    let fallbackInterval = null;

    const connectStream = () => {
      if (typeof window === 'undefined' || !window.EventSource) return;

      try {
        const es = new EventSource(`/api/assessments/${assessmentId}/stream`);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (isMounted) setStreamConnected(true);
        };

        es.onmessage = (e) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(e.data);

            if (data.type === 'init') {
              setAssessment(data.assessment || null);
              setTestRun(data.testRun || null);
              setEvents(data.events || []);
              setEvidenceList(data.evidenceList || []);
              setScenarios(data.scenarios || []);
              if (data.testRun?.latestScreenshot) {
                setLatestScreenshot(data.testRun.latestScreenshot);
                setLatestScreenshotUrl(data.testRun.latestScreenshotUrl || data.testRun.currentUrl || '');
                setLatestScreenshotTime(data.testRun.latestScreenshotTime || new Date());
              }
              setLoading(false);
            } else if (data.type === 'event') {
              const ev = data.event;
              setEvents((prev) => [...prev, ev]);

              // Update live screenshot if screenshot event
              if (ev.screenshotPath) {
                setLatestScreenshot(ev.screenshotPath);
                setLatestScreenshotUrl(ev.url || '');
                setLatestScreenshotTime(ev.timestamp || new Date());
                // Reset error state for incoming screenshot
                setImgErrors((prev) => ({ ...prev, [ev.screenshotPath]: false }));
              }

              // Real-time update for evaluated statutory scenarios
              if (ev.eventType === 'scenario_evaluated' && ev.data?.scenario) {
                setScenarios((prev) => {
                  const existingIdx = prev.findIndex((s) => s.scenarioId === ev.data.scenario.scenarioId);
                  if (existingIdx >= 0) {
                    const updated = [...prev];
                    updated[existingIdx] = ev.data.scenario;
                    return updated;
                  }
                  return [...prev, ev.data.scenario];
                });
              }

              // Update test run snapshot
              setTestRun((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  progress: ev.progress !== null && ev.progress !== undefined ? ev.progress : prev.progress,
                  currentStep: ev.stepName || prev.currentStep,
                  status: ev.eventType === 'completed' ? 'completed'
                    : ev.eventType === 'failed' ? 'failed'
                    : ev.eventType === 'cancelled' ? 'cancelled'
                    : ev.eventType === 'human_intervention' ? 'awaiting_user_input'
                    : prev.status,
                  userAssistanceRequired: ev.eventType === 'human_intervention' ? true : prev.userAssistanceRequired,
                };
              });

              // Add to evidence list if screenshot
              if (ev.eventType === 'screenshot_captured' && ev.screenshotPath) {
                setEvidenceList((prev) => {
                  const exists = prev.some((x) => x.screenshotPath === ev.screenshotPath);
                  if (exists) return prev;
                  return [
                    ...prev,
                    {
                      _id: `ev-${Date.now()}`,
                      screenshotPath: ev.screenshotPath,
                      pageUrl: ev.url,
                      pageTitle: ev.title,
                      timestamp: ev.timestamp,
                      scenarioId: ev.data?.scenarioId || 'browser_inspection',
                    },
                  ];
                });
              }

              // When completed or failed, synchronize with MongoDB snapshot
              if (ev.eventType === 'completed' || ev.eventType === 'failed') {
                setTimeout(fetchSnapshot, 600);
              }


            }
          } catch (parseErr) {
            console.error('Error parsing SSE event:', parseErr);
          }
        };

        es.onerror = () => {
          if (isMounted) setStreamConnected(false);
          // If SSE stream fails, fallback to HTTP JSON polling
          if (!fallbackInterval) {
            fallbackInterval = setInterval(fetchSnapshot, 3000);
          }
        };
      } catch (err) {
        console.error('Failed to initialize EventSource:', err);
        fallbackInterval = setInterval(fetchSnapshot, 3000);
      }
    };

    connectStream();
    fetchSnapshot();

    return () => {
      isMounted = false;
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [assessmentId, fetchSnapshot]);

  // Handle user interaction: Cancel, Resume, Acknowledge
  const handleControlAction = async (action) => {
    try {
      setIsActionLoading(true);
      setActionMessage('');
      const res = await fetch(`/api/assessments/${assessmentId}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message || 'Action executed successfully.');
        if (data.testRun) setTestRun(data.testRun);
      } else {
        alert(data.error || 'Failed to execute action');
      }
    } catch (err) {
      alert(`Action error: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  // Trigger Playwright worker to claim and execute the run immediately
  const handleTriggerWorker = async () => {
    try {
      setIsActionLoading(true);
      setActionMessage('');
      const res = await fetch('/api/worker/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: testRun?._id, force: true }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message || 'Worker successfully claimed job.');
        if (data.testRun) setTestRun(data.testRun);
        fetchSnapshot();
      } else {
        alert(data.message || data.error || 'Failed to trigger worker');
      }
    } catch (err) {
      alert(`Worker trigger error: ${err.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const status = testRun?.status || assessment?.status || 'queued';
  const isQueued = status === 'queued';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';
  const isCancelled = status === 'cancelled';
  const isPaused = status === 'awaiting_user_input' || testRun?.userAssistanceRequired;
  const isRunning = !isCompleted && !isFailed && !isCancelled && !isPaused && !isQueued;
  const progressPct = typeof testRun?.progress === 'number'
    ? testRun.progress
    : (isCompleted ? 100 : isQueued ? 0 : 15);

  const targetDomain = testRun?.targetId?.approvedDomain || assessment?.targetUrl?.replace(/^https?:\/\//, '') || 'Website In-Scope';
  const targetUrl = testRun?.targetId?.targetUrl || assessment?.targetUrl || 'https://' + targetDomain;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Link
              href="/portal"
              className="font-medium text-slate-500 hover:text-slate-900 transition-colors"
            >
              &larr; Customer Workspace
            </Link>
            <span className="text-slate-300">&bull;</span>
            <span className="font-mono text-slate-500">ID: {String(assessmentId).slice(-8)}</span>
            <span className="text-slate-300">&bull;</span>
            <span className="font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              Run #{assessment?.sequenceNumber || 1}
            </span>
            {assessment?.isReassessment && (
              <span className="font-semibold px-2 py-0.5 rounded bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5]">
                Reassessment
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-[#2d523e]" />
            <span>{targetDomain}</span>
          </h1>
          <p className="text-xs text-slate-500">
            Real-time automated Playwright browser inspection for DPDP Act 2023 compliance.
          </p>
        </div>

        {/* Live Status Badge & Stream Indicator */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {streamConnected && isRunning && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Stream Active</span>
            </div>
          )}

          <div
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border shadow-2xs ${
              isCompleted
                ? 'bg-[#eaf2ed] text-[#2d523e] border-[#d0e2d5]'
                : isFailed
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : isCancelled
                ? 'bg-slate-100 text-slate-600 border-slate-300'
                : isPaused
                ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                : 'bg-emerald-50 text-[#2d523e] border-emerald-200'
            }`}
          >
            {status.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Human Intervention Required Alert */}
      {isPaused && (
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 font-bold text-sm">
              <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
              <span>Assisted Verification Encountered (Security Verification Prompt)</span>
            </div>
            <button
              onClick={() => handleControlAction('resume')}
              disabled={isActionLoading}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#2d523e] hover:bg-[#234131] text-white shadow-xs transition-all disabled:opacity-50"
            >
              {isActionLoading ? 'Acknowledging...' : 'Acknowledge & Continue'}
            </button>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">
            {testRun?.userAssistancePrompt ||
              'A security challenge (such as a multi-factor OTP or verification prompt) was detected on the test login form. The inspector safely paused in accordance with DPDP security protocols without attempting an unauthorized bypass.'}
          </p>
        </div>
      )}

      {/* Real Failure Alert (No Fake Success Fallback) */}
      {isFailed && (
        <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 space-y-3 shadow-xs">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 font-bold text-sm">
              <XCircle className="w-5 h-5 text-rose-700 flex-shrink-0" />
              <span>Assessment Execution Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsRetryMode(true);
                  setReassessModalOpen(true);
                }}
                id="retry-assessment-btn"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-rose-700 hover:bg-rose-800 text-white shadow-xs transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Assessment</span>
              </button>
              <Link
                href="/portal/onboarding"
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-white border border-rose-200 text-rose-800 hover:bg-rose-100/50 shadow-xs transition-all"
              >
                Configure New Target
              </Link>
            </div>
          </div>
          <p className="text-xs text-rose-800 font-mono leading-relaxed">
            {testRun?.errorMessage || assessment?.failureReason || 'Automated inspection worker encountered an error during execution.'}
          </p>
        </div>
      )}

      {/* 2. Main Live Inspection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Browser Preview (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            {/* Browser Window Header */}
            <div className="p-3 bg-slate-100/90 border-b border-slate-200 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Window Dots */}
                <div className="flex items-center gap-1.5 mr-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                </div>

                {/* Simulated Address Bar */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs text-xs font-mono text-slate-700 flex-1 truncate">
                  <Lock className="w-3.5 h-3.5 text-[#2d523e] flex-shrink-0" />
                  <span className="truncate">{latestScreenshotUrl || targetUrl}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {latestScreenshot && (
                  <button
                    onClick={() => setSelectedImageModal(latestScreenshot)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
                    title="Expand Screenshot"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Live Screenshot Viewport */}
            <div className="relative bg-slate-50 min-h-[400px] flex items-center justify-center p-2 overflow-hidden">
              {latestScreenshot && !imgErrors[latestScreenshot] ? (
                <div className="w-full h-full flex flex-col items-center">
                  <img
                    src={latestScreenshot}
                    alt="Live Automated Browser Preview"
                    className="w-full h-auto max-h-[520px] object-contain rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:opacity-98 transition-all"
                    onClick={() => setSelectedImageModal(latestScreenshot)}
                    onError={() => setImgErrors((prev) => ({ ...prev, [latestScreenshot]: true }))}
                  />
                  <div className="w-full mt-2.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200/90 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="font-semibold text-slate-800">Live Automated Browser Capture</span>
                      <span>&bull;</span>
                      <span className="font-mono text-slate-600 truncate max-w-[280px]">
                        {latestScreenshotUrl || targetUrl}
                      </span>
                    </div>
                    {latestScreenshotTime && (
                      <span className="font-mono text-slate-400">
                        {new Date(latestScreenshotTime).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              ) : latestScreenshot && imgErrors[latestScreenshot] ? (
                <div className="text-center p-8 space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center mx-auto shadow-2xs">
                    <Camera className="w-7 h-7 text-slate-500" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-800">Screenshot Stored (Ready)</h3>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Evidence screenshot captured and recorded in MongoDB. Click below to view image directly.
                    </p>
                  </div>
                  <a
                    href={latestScreenshot}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2d523e] text-white hover:bg-[#234131] transition-colors"
                  >
                    <span>Open Evidence View</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : isQueued ? (
                /* Queued / Waiting for Worker State */
                <div className="text-center p-8 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto shadow-2xs animate-pulse">
                    <Clock className="w-8 h-8 text-amber-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">
                      Waiting for Playwright Worker
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Assessment job has been submitted to the queue. Waiting for an active Playwright worker agent to claim the job and launch browser testing.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleTriggerWorker}
                      disabled={isActionLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#2d523e] text-white hover:bg-[#234131] shadow-xs transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{isActionLoading ? 'Assigning Worker...' : 'Launch Worker Now'}</span>
                    </button>
                  </div>
                </div>
              ) : isFailed ? (
                /* Failed State */
                <div className="text-center p-8 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto shadow-2xs">
                    <AlertTriangle className="w-8 h-8 text-rose-600" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-rose-900">
                      Inspection Execution Failed
                    </h3>
                    <p className="text-xs text-rose-600 max-w-md mx-auto">
                      {testRun?.errorMessage || assessment?.failureReason || 'An error occurred during Playwright inspection.'}
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleTriggerWorker}
                      disabled={isActionLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-xs transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{isActionLoading ? 'Retrying...' : 'Retry Inspection'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Launching / Empty State */
                <div className="text-center p-8 space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] flex items-center justify-center mx-auto shadow-2xs animate-pulse">
                    <Globe className="w-8 h-8 text-[#2d523e]" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-900">
                      {isRunning ? 'Connecting Sandboxed Chromium Browser...' : 'Ready for Inspection'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {isRunning
                        ? 'Playwright is initializing an isolated browser session. Live viewport screenshots will stream here automatically.'
                        : 'Inspection is currently idle or complete.'}
                    </p>
                  </div>
                  {isRunning && (
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono text-slate-600">
                        <RefreshCw className="w-3 h-3 animate-spin text-[#2d523e]" />
                        <span>{testRun?.currentStep || 'Initializing browser sandbox'}</span>
                      </div>
                      <div className="pt-2 flex flex-col items-center gap-2">
                        <button
                          onClick={handleTriggerWorker}
                          disabled={isActionLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#2d523e] text-white hover:bg-[#234131] shadow-xs transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{isActionLoading ? 'Starting Worker...' : 'Trigger Playwright Worker Now'}</span>
                        </button>
                        <p className="text-[11px] text-slate-400 max-w-xs">
                          In serverless production (Vercel), ensure your persistent worker daemon (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">npm run worker</code>) is running, or click above to trigger execution.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Captured Evidence Gallery */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#2d523e]" />
                <span>Captured Evidence Screenshots ({evidenceList.length})</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">
                Stored in MongoDB &bull; Traceable
              </span>
            </div>

            {evidenceList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {evidenceList.slice(-8).map((ev, idx) => (
                  <div
                    key={idx}
                    onClick={() => !imgErrors[ev.screenshotPath] && setSelectedImageModal(ev.screenshotPath)}
                    className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 cursor-pointer hover:border-[#2d523e] transition-all aspect-video flex items-center justify-center shadow-2xs"
                  >
                    {!imgErrors[ev.screenshotPath] ? (
                      <img
                        src={ev.screenshotPath}
                        alt={ev.pageTitle || 'Evidence'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        onError={() => setImgErrors((prev) => ({ ...prev, [ev.screenshotPath]: true }))}
                      />
                    ) : (
                      <div className="p-2 text-center flex flex-col items-center justify-center space-y-1">
                        <Camera className="w-4 h-4 text-slate-400" />
                        <span className="text-[10px] text-slate-600 line-clamp-1">{ev.pageTitle || 'Evidence'}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-semibold p-1 text-center">
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      <span>View</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Screenshots will appear here as the automated browser visits in-scope pages.
              </p>
            )}
          </div>
        </div>

        {/* Right Column: Execution Status, Timeline & Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Current Step & Progress Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Inspection Progress
              </span>
              <span className="font-mono text-sm font-bold text-[#2d523e]">
                {progressPct}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full transition-all duration-700 rounded-full ${
                  isCompleted ? 'bg-[#2d523e]' : isFailed ? 'bg-rose-500' : 'bg-[#2d523e]'
                }`}
                style={{ width: `${Math.max(progressPct, 4)}%` }}
              />
            </div>

            {/* Current Step Info */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] uppercase font-bold text-[#2d523e] block">
                Active Inspection Phase
              </span>
              <p className="text-xs font-semibold text-slate-800 leading-snug">
                {testRun?.currentStep || 'Initializing test pipeline'}
              </p>
            </div>

            {/* Controls */}
            {isQueued && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Waiting for worker</span>
                </span>
                <button
                  onClick={handleTriggerWorker}
                  disabled={isActionLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#2d523e] text-white hover:bg-[#234131] transition-colors disabled:opacity-50"
                >
                  {isActionLoading ? 'Assigning...' : 'Trigger Worker'}
                </button>
              </div>
            )}

            {isRunning && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">Execution in progress</span>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel this live assessment?')) {
                      handleControlAction('cancel');
                    }
                  }}
                  disabled={isActionLoading}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors disabled:opacity-50"
                >
                  Cancel Assessment
                </button>
              </div>
            )}
          </div>

          {/* 6-Stage Milestone Tracker */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span>Statutory Compliance Stages</span>
              <span className="text-[10px] text-slate-400 font-mono">DPDP Act 2023</span>
            </h3>

            <div className="space-y-3.5">
              {MILESTONES.map((m) => {
                const isMilestoneDone = isCompleted || progressPct >= m.minPct;
                const isMilestoneActive =
                  !isCompleted &&
                  !isFailed &&
                  progressPct < m.minPct &&
                  progressPct >= m.minPct - 20;

                return (
                  <div key={m.id} className="flex items-start gap-3 text-xs">
                    <div className="mt-0.5 flex-shrink-0">
                      {isMilestoneDone ? (
                        <div className="w-5 h-5 rounded-full bg-[#eaf2ed] text-[#2d523e] border border-[#d0e2d5] flex items-center justify-center">
                          <Check className="w-3 h-3 text-[#2d523e]" />
                        </div>
                      ) : isMilestoneActive ? (
                        <div className="w-5 h-5 rounded-full bg-emerald-50 text-[#2d523e] border border-emerald-300 flex items-center justify-center animate-pulse">
                          <Clock className="w-3 h-3 animate-spin text-[#2d523e]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center text-[10px] font-bold">
                          {m.id}
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5 flex-1 min-w-0">
                      <h4
                        className={`font-bold leading-tight ${
                          isMilestoneDone
                            ? 'text-slate-900'
                            : isMilestoneActive
                            ? 'text-[#2d523e]'
                            : 'text-slate-400'
                        }`}
                      >
                        {m.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-tight truncate">
                        {m.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Recent Activity Stream */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#2d523e]" />
                <span>Recent Browser Activity</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {events.length} events
              </span>
            </h3>

            <div className="max-h-56 overflow-y-auto space-y-2.5 pr-1 text-xs">
              {events.length > 0 ? (
                [...events].reverse().slice(0, 20).map((ev, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-semibold text-slate-700 capitalize flex items-center gap-1.5">
                        {idx === 0 && !isCompleted && !isFailed && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        )}
                        {ev.title}
                      </span>
                      <span className="font-mono text-slate-400">
                        {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ''}
                      </span>
                    </div>
                    {ev.description && (
                      <p className="text-[11px] text-slate-600 leading-tight">
                        {ev.description}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">
                  Live execution events will appear here in real-time.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Verified Findings Summary (Empirical & Traceable) */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2d523e]" />
              <span>Evidence-Based Statutory Scenarios ({scenarios.length})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Findings supported strictly by empirical observations captured during automated inspection.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
              {scenarios.length} Evaluated
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              {scenarios.filter((s) => s.status === 'passed').length} Passed
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
              {scenarios.filter((s) => s.status === 'needs_review').length} Needs Review
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
              {scenarios.filter((s) => s.status === 'failed').length} Failed
            </span>
            {scenarios.some((s) => ['skipped', 'not_tested', 'not_applicable'].includes(s.status)) && (
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                {scenarios.filter((s) => ['skipped', 'not_tested', 'not_applicable'].includes(s.status)).length} Excluded
              </span>
            )}
          </div>
        </div>

        {scenarios.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((sc, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-2 shadow-2xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-mono uppercase font-semibold text-slate-500">
                      {sc.category ? sc.category.replace(/_/g, ' ') : 'Requirement'}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        sc.status === 'passed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : sc.status === 'failed'
                          ? 'bg-rose-100 text-rose-800'
                          : sc.status === 'skipped' || sc.status === 'not_applicable' || sc.status === 'not_tested'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {sc.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug">
                    {sc.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {sc.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/80 text-[10px] text-slate-400 font-mono">
                  {sc.dpdpReference || 'DPDP Act 2023'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">
            Scenario findings will update here in real-time as statutory evaluations finish.
          </p>
        )}
      </div>

      {/* 4. Completion State Banner (Links to Official Report) */}
      {isCompleted && (
        <div className="p-6 rounded-2xl bg-[#eaf2ed] border border-[#d0e2d5] text-[#2d523e] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#1e382a] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[#2d523e]" />
              <span>Website Assessment Completed Successfully</span>
            </h3>
            <p className="text-xs text-[#2d523e] leading-relaxed">
              All 6 statutory assessment checks evaluated with empirical evidence. Your comprehensive DPDP compliance report is ready.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
            {assessment?.previousAssessmentId && (
              <Link
                href={`/portal/reports/${assessment.previousAssessmentId}`}
                id="view-previous-report-btn"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>View Previous Report</span>
              </Link>
            )}

            {(assessment?.previousAssessmentId || assessment?.isReassessment) && (
              <Link
                href={`/portal/assessments/${assessmentId}/compare`}
                id="compare-reports-btn"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-[#d0e2d5] text-[#2d523e] hover:bg-[#f7f9f7] transition-all"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Compare Reports</span>
              </Link>
            )}

            <button
              onClick={() => {
                setIsRetryMode(false);
                setReassessModalOpen(true);
              }}
              id="run-reassessment-btn"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-white border border-[#2d523e] text-[#2d523e] hover:bg-[#eaf2ed] shadow-2xs transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Run Reassessment</span>
            </button>

            <Link
              href={`/portal/reports/${assessmentId}`}
              id="view-final-report-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all"
            >
              <span>View Comprehensive Report</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Reassessment & Retry Modal */}
      <ReassessmentModal
        isOpen={reassessModalOpen}
        onClose={() => setReassessModalOpen(false)}
        assessment={assessment}
        targetUrl={targetUrl}
        websiteName={assessment?.websiteName}
        currentSequence={assessment?.sequenceNumber || 1}
        isRetry={isRetryMode}
      />

      {/* Lightbox Screenshot Modal */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs"
          onClick={() => setSelectedImageModal(null)}
        >
          <div
            className="relative max-w-5xl w-full bg-white rounded-2xl p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Camera className="w-4 h-4 text-[#2d523e]" />
                <span>Captured Automated Screenshot</span>
              </div>
              <button
                onClick={() => setSelectedImageModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[80vh] overflow-auto rounded-lg bg-slate-50 flex items-center justify-center">
              <img
                src={selectedImageModal}
                alt="Full Resolution Screenshot"
                className="w-full h-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
