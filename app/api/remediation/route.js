import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb.js';
import Finding from '../../../models/Finding.js';
import { requireAuth } from '../../../lib/auth.js';

/**
 * GET /api/remediation
 * Lists remediation items, responsible assignees, due dates, and KPI metrics.
 */
export async function GET(request) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');
    const remediationStatus = searchParams.get('remediationStatus');
    const assignedTo = searchParams.get('assignedTo');

    const query = {};
    if (session.organizationId) {
      query.organization = session.organizationId;
    }
    if (assessmentId) query.assessment = assessmentId;
    if (remediationStatus && remediationStatus !== 'all') {
      query.remediationStatus = remediationStatus;
    }
    if (assignedTo) {
      query.assignedTo = new RegExp(assignedTo, 'i');
    }

    const tasks = await Finding.find(query)
      .populate('assessment', 'name createdAt')
      .populate('requirement')
      .sort({ severity: 1, createdAt: -1 })
      .lean();

    const stats = {
      total: tasks.length,
      open: tasks.filter((t) => t.remediationStatus === 'open').length,
      inProgress: tasks.filter((t) => t.remediationStatus === 'in_progress').length,
      resolved: tasks.filter((t) => t.remediationStatus === 'resolved').length,
      riskAccepted: tasks.filter((t) => t.remediationStatus === 'risk_accepted').length,
    };

    return NextResponse.json({
      success: true,
      stats,
      tasks,
    });
  } catch (err) {
    console.error('Error fetching remediation tasks:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/remediation
 * Assigns finding, sets due date, updates remediation status and notes.
 */
export async function PATCH(request) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await request.json();
    const {
      findingId,
      remediationStatus,
      assignedTo,
      assignedEmail,
      dueDate,
      remediationNotes,
      evidence,
    } = body;

    if (!findingId) {
      return NextResponse.json({ success: false, error: 'findingId is required' }, { status: 400 });
    }

    const finding = await Finding.findById(findingId);
    if (!finding) {
      return NextResponse.json({ success: false, error: 'Finding not found' }, { status: 404 });
    }

    if (remediationStatus) {
      if (!['open', 'in_progress', 'resolved', 'risk_accepted'].includes(remediationStatus)) {
        return NextResponse.json(
          { success: false, error: 'Invalid remediationStatus' },
          { status: 400 }
        );
      }
      finding.remediationStatus = remediationStatus;
      if (remediationStatus === 'resolved') {
        finding.resolvedAt = new Date();
      }
    }

    if (assignedTo !== undefined) finding.assignedTo = assignedTo;
    if (assignedEmail !== undefined) finding.assignedEmail = assignedEmail;
    if (dueDate !== undefined) finding.dueDate = dueDate ? new Date(dueDate) : null;
    if (remediationNotes !== undefined) finding.remediationNotes = remediationNotes;
    if (evidence) finding.evidence = { ...finding.evidence, ...evidence };

    await finding.save();

    return NextResponse.json({
      success: true,
      message: 'Remediation task updated successfully',
      finding,
    });
  } catch (err) {
    console.error('Error updating remediation task:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/remediation
 * Retests a finding, compares previous and new results, and logs to retestHistory audit trail.
 */
export async function POST(request) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await request.json();
    const { findingId, newStatus, notes } = body;

    if (!findingId || !newStatus) {
      return NextResponse.json(
        { success: false, error: 'findingId and newStatus are required' },
        { status: 400 }
      );
    }

    if (!['pass', 'fail', 'needs_review'].includes(newStatus)) {
      return NextResponse.json(
        { success: false, error: 'newStatus must be pass, fail, or needs_review' },
        { status: 400 }
      );
    }

    const finding = await Finding.findById(findingId);
    if (!finding) {
      return NextResponse.json({ success: false, error: 'Finding not found' }, { status: 404 });
    }

    const previousStatus = finding.status;

    // Record audit trail in retestHistory
    finding.retestHistory.push({
      retestedAt: new Date(),
      previousStatus,
      newStatus,
      notes: notes || `Retested by ${session.name || 'reviewer'}`,
      retestedBy: session.userId || null,
    });

    // Update current status
    finding.status = newStatus;

    if (newStatus === 'pass') {
      finding.remediationStatus = 'resolved';
      finding.resolvedAt = new Date();
      finding.resolutionNotes = notes || 'Resolved via automated/manual retest verification';
    } else if (newStatus === 'fail') {
      finding.remediationStatus = 'open';
    }

    await finding.save();

    return NextResponse.json({
      success: true,
      message: `Retest completed: Status changed from ${previousStatus} to ${newStatus}`,
      finding,
    });
  } catch (err) {
    console.error('Error retesting finding:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
