'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wrench,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  Calendar,
  RotateCcw,
  Edit2,
  Plus,
  X,
  History,
  ArrowRight,
  ShieldAlert,
  Send
} from 'lucide-react';
import EmptyState from '@/components/EmptyState';

export default function RemediationPage() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, riskAccepted: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  // Edit / Assignment Modal
  const [editingTask, setEditingTask] = useState(null);
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedEmail, setAssignedEmail] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [remediationStatus, setRemediationStatus] = useState('open');
  const [remediationNotes, setRemediationNotes] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  // Retest Modal
  const [retestingTask, setRetestingTask] = useState(null);
  const [retestStatus, setRetestStatus] = useState('pass');
  const [retestNotes, setRetestNotes] = useState('');
  const [savingRetest, setSavingRetest] = useState(false);

  // Retest History Drawer
  const [historyTask, setHistoryTask] = useState(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/remediation');
      const data = await res.json();
      if (data.success) {
        setTasks(data.tasks || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching remediation tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const openEditModal = (task) => {
    setEditingTask(task);
    setAssignedTo(task.assignedTo || '');
    setAssignedEmail(task.assignedEmail || '');
    setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setRemediationStatus(task.remediationStatus || 'open');
    setRemediationNotes(task.remediationNotes || '');
  };

  const handleSaveEdit = async () => {
    if (!editingTask) return;
    try {
      setSavingTask(true);
      const res = await fetch('/api/remediation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingId: editingTask._id,
          remediationStatus,
          assignedTo,
          assignedEmail,
          dueDate: dueDate || null,
          remediationNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTasks((prev) =>
          prev.map((t) => (t._id === editingTask._id ? data.finding : t))
        );
        setEditingTask(null);
        fetchTasks(); // refresh stats
      } else {
        alert(data.error || 'Failed to update task');
      }
    } catch (err) {
      alert(`Error updating remediation: ${err.message}`);
    } finally {
      setSavingTask(false);
    }
  };

  const openRetestModal = (task) => {
    setRetestingTask(task);
    setRetestStatus('pass');
    setRetestNotes(`Verification of corrective action for ${task.requirementId}`);
  };

  const handleExecuteRetest = async () => {
    if (!retestingTask) return;
    try {
      setSavingRetest(true);
      const res = await fetch('/api/remediation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          findingId: retestingTask._id,
          newStatus: retestStatus,
          notes: retestNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setTasks((prev) =>
          prev.map((t) => (t._id === retestingTask._id ? data.finding : t))
        );
        setRetestingTask(null);
        fetchTasks(); // refresh stats
      } else {
        alert(data.error || 'Retest failed');
      }
    } catch (err) {
      alert(`Error executing retest: ${err.message}`);
    } finally {
      setSavingRetest(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === 'all') return true;
    return t.remediationStatus === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs relative overflow-hidden">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eaf2ed] border border-[#d0e2d5] text-[#2d523e] text-xs font-semibold">
            <Wrench className="w-3.5 h-3.5" />
            <span>DPDP Statutory Remediation Tracker</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Remediation Action Tracker & Retest Board
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            Assign engineers, track SLA deadlines, attach updated evidence, and execute verifiable retests with complete historical audit trails.
          </p>
        </div>

        <Link
          href="/reports"
          id="view-audit-reports-btn"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#2d523e] hover:bg-[#234232] text-white shadow-xs transition-all self-start sm:self-auto"
        >
          <span>View Audit Reports</span>
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-semibold block">Pending Open</span>
            <span className="text-2xl font-bold text-rose-700 mt-1 block">{stats.open}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-semibold block">In Progress</span>
            <span className="text-2xl font-bold text-sky-700 mt-1 block">{stats.inProgress}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-semibold block">Verified Resolved</span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">{stats.resolved}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-500 uppercase font-semibold block">Risk Accepted</span>
            <span className="text-2xl font-bold text-slate-700 mt-1 block">{stats.riskAccepted}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
        {['all', 'open', 'in_progress', 'resolved', 'risk_accepted'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all whitespace-nowrap ${
              statusFilter === st
                ? 'bg-[#eaf2ed] text-[#2d523e] font-bold border border-[#d0e2d5]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {st.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-slate-100 border border-slate-200 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No Remediation Tasks Found"
          description="When an automated assessment detects privacy non-conformities, corrective action items will be generated here for tracking and resolution."
          primaryActionText="Run New Assessment"
          primaryActionHref="/assessments/new"
          secondaryActionText="View Open Findings"
          secondaryActionHref="/findings"
        />
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((t) => {
            const statusBadge = {
              open: 'bg-rose-50 text-rose-800 border-rose-200',
              in_progress: 'bg-sky-50 text-sky-800 border-sky-200',
              resolved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              risk_accepted: 'bg-slate-100 text-slate-700 border-slate-200',
            }[t.remediationStatus] || 'bg-slate-100 text-slate-700';

            const severityBadge = {
              critical: 'text-rose-800 bg-rose-50 border-rose-200 font-semibold',
              high: 'text-orange-800 bg-orange-50 border-orange-200 font-semibold',
              medium: 'text-amber-800 bg-amber-50 border-amber-200',
              low: 'text-sky-800 bg-sky-50 border-sky-200',
              informational: 'text-slate-700 bg-slate-100 border-slate-200',
            }[t.severity] || 'text-slate-700 bg-slate-100';

            return (
              <div
                key={t._id}
                className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all space-y-3.5 shadow-xs hover:shadow-sm"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold text-[#2d523e] bg-[#eaf2ed] px-2 py-0.5 rounded border border-[#d0e2d5]">
                        {t.requirementId}
                      </span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${severityBadge}`}>
                        {t.severity}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {t.ruleId}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 pt-0.5">
                      {t.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
                    <span className={`text-xs font-bold uppercase px-3 py-1 rounded-lg border ${statusBadge}`}>
                      {t.remediationStatus.replace(/_/g, ' ')}
                    </span>

                    {/* Action buttons */}
                    <button
                      onClick={() => openEditModal(t)}
                      id={`edit-task-${t._id}`}
                      className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-all shadow-xs"
                      title="Edit Assignment & Status"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => openRetestModal(t)}
                      id={`retest-task-${t._id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#eaf2ed] hover:bg-[#dfece3] text-[#2d523e] border border-[#d0e2d5] text-xs font-semibold transition-all shadow-xs"
                      title="Retest & Verify"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retest</span>
                    </button>
                  </div>
                </div>

                {/* Remediation Action Description */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">
                    Required Corrective Action
                  </span>
                  <p className="text-slate-700 leading-relaxed">
                    {t.recommendedRemediation || t.explanation}
                  </p>
                  {t.remediationNotes && (
                    <div className="pt-2 border-t border-slate-200 text-slate-600 italic">
                      <span className="font-semibold text-slate-800">Engineering Notes: </span>
                      {t.remediationNotes}
                    </div>
                  )}
                </div>

                {/* Assignment & Audit Meta footer */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Assignee: <strong className="text-slate-800">{t.assignedTo || 'Unassigned'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        Due: <strong className="text-slate-800">{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'Not Set'}</strong>
                      </span>
                    </div>
                  </div>

                  {t.retestHistory && t.retestHistory.length > 0 && (
                    <button
                      onClick={() => setHistoryTask(t)}
                      className="inline-flex items-center gap-1.5 text-[#2d523e] hover:underline text-xs font-medium"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Retest Audit Trail ({t.retestHistory.length})</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Assignment Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Update Remediation Task</h3>
                <p className="text-xs text-slate-500">{editingTask.requirementId}</p>
              </div>
              <button
                onClick={() => setEditingTask(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Responsible Owner</label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="e.g. Priya Sharma (Lead Dev)"
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-xs"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Owner Email</label>
                  <input
                    type="email"
                    value={assignedEmail}
                    onChange={(e) => setAssignedEmail(e.target.value)}
                    placeholder="priya@company.com"
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Remediation Status</label>
                  <select
                    value={remediationStatus}
                    onChange={(e) => setRemediationStatus(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600 shadow-xs"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="risk_accepted">Risk Accepted</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-emerald-600 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Engineering / Progress Notes</label>
                <textarea
                  value={remediationNotes}
                  onChange={(e) => setRemediationNotes(e.target.value)}
                  placeholder="Record PR links, technical changes, or resolution steps..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingTask}
                className="px-4 py-2 rounded-xl bg-[#2d523e] hover:bg-[#234232] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {savingTask ? 'Saving...' : 'Save Task Updates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retest Verification Modal */}
      {retestingTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Retest Verification</h3>
                <p className="text-xs text-slate-500">Current Status: {retestingTask.status.toUpperCase()}</p>
              </div>
              <button
                onClick={() => setRetestingTask(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">New Retest Outcome</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'pass', label: 'Pass', color: 'border-emerald-500 text-emerald-800 bg-emerald-50' },
                    { val: 'fail', label: 'Fail', color: 'border-rose-500 text-rose-800 bg-rose-50' },
                    { val: 'needs_review', label: 'Needs Review', color: 'border-amber-500 text-amber-800 bg-amber-50' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setRetestStatus(item.val)}
                      className={`py-2 px-3 rounded-xl capitalize font-semibold border text-center transition-all ${
                        retestStatus === item.val
                          ? `${item.color} font-bold shadow-xs`
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Retest Verification Notes</label>
                <textarea
                  value={retestNotes}
                  onChange={(e) => setRetestNotes(e.target.value)}
                  placeholder="Record retest verification method, URL, and observed changes..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 shadow-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRetestingTask(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRetest}
                disabled={savingRetest}
                className="px-4 py-2 rounded-xl bg-[#2d523e] hover:bg-[#234232] text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {savingRetest ? 'Recording...' : 'Record Retest Result'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retest History Audit Trail Modal */}
      {historyTask && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Retest History & Audit Trail</h3>
                <p className="text-xs text-slate-500">{historyTask.requirementId}</p>
              </div>
              <button
                onClick={() => setHistoryTask(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {historyTask.retestHistory && historyTask.retestHistory.length > 0 ? (
                historyTask.retestHistory.map((h, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs text-slate-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">
                        {new Date(h.retestedAt).toLocaleString()}
                      </span>
                      <div className="flex items-center gap-1.5 font-bold uppercase">
                        <span className="text-rose-700">{h.previousStatus}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="text-emerald-700">{h.newStatus}</span>
                      </div>
                    </div>
                    {h.notes && <p className="text-slate-600 italic">{h.notes}</p>}
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">No retest logs recorded.</p>
              )}
            </div>

            <div className="text-right pt-2 border-t border-slate-100">
              <button
                onClick={() => setHistoryTask(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
