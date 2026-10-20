import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb.js';
import Finding from '../../../models/Finding.js';
import LegalRequirement from '../../../models/LegalRequirement.js';
import Evidence from '../../../models/Evidence.js';
import { requireAuth, ROLES } from '../../../lib/auth.js';

/**
 * GET /api/findings
 * Lists findings filtered by assessment, status, reviewer decision, or severity.
 */
export async function GET(request) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');
    const status = searchParams.get('status');
    const reviewerDecision = searchParams.get('reviewerDecision');
    const remediationStatus = searchParams.get('remediationStatus');
    const severity = searchParams.get('severity');

    const query = {};
    if (session.organizationId) {
      query.organization = session.organizationId;
    }
    if (assessmentId) query.assessment = assessmentId;
    if (status && status !== 'all') query.status = status;
    if (reviewerDecision && reviewerDecision !== 'all') query.reviewerDecision = reviewerDecision;
    if (remediationStatus && remediationStatus !== 'all') query.remediationStatus = remediationStatus;
    if (severity && severity !== 'all') query.severity = severity;

    const findings = await Finding.find(query)
      .populate('requirement')
      .populate('evidenceReferences')
      .sort({ createdAt: -1 })
      .limit(150)
      .lean();

    return NextResponse.json({
      success: true,
      count: findings.length,
      findings,
    });
  } catch (err) {
    console.error('Error fetching findings:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/findings
 * Human Review Workflow: Approve, amend, or reject AI-generated findings.
 */
export async function PATCH(request) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await request.json();
    const {
      findingId,
      reviewerDecision,
      reviewerNotes,
      status,
      severity,
      explanation,
      recommendedRemediation,
    } = body;

    if (!findingId) {
      return NextResponse.json({ success: false, error: 'findingId is required' }, { status: 400 });
    }

    if (
      reviewerDecision &&
      !['pending', 'approved', 'amended', 'rejected'].includes(reviewerDecision)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid reviewerDecision. Must be approved, amended, or rejected.' },
        { status: 400 }
      );
    }

    const finding = await Finding.findById(findingId);
    if (!finding) {
      return NextResponse.json({ success: false, error: 'Finding not found' }, { status: 404 });
    }

    // Apply reviewer updates
    if (reviewerDecision) finding.reviewerDecision = reviewerDecision;
    if (reviewerNotes !== undefined) finding.reviewerNotes = reviewerNotes;
    if (status) finding.status = status;
    if (severity) finding.severity = severity;
    if (explanation) finding.explanation = explanation;
    if (recommendedRemediation) finding.recommendedRemediation = recommendedRemediation;

    finding.reviewedBy = session.userId || null;
    finding.reviewedAt = new Date();

    await finding.save();

    return NextResponse.json({
      success: true,
      message: `Finding ${reviewerDecision ? reviewerDecision : 'updated'} successfully`,
      finding,
    });
  } catch (err) {
    console.error('Error reviewing finding:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
