import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import Evidence from '../../../models/Evidence';
import { requireAuth } from '../../../lib/auth';

/**
 * GET /api/evidence
 * List evidence records with optional filtering by assessmentId or testRunId.
 */
export async function GET(request) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');
    const testRunId = searchParams.get('testRunId');
    const scenarioId = searchParams.get('scenarioId');

    const filter = {};
    if (assessmentId) filter.assessmentId = assessmentId;
    if (testRunId) filter.testRunId = testRunId;
    if (scenarioId) filter.scenarioId = scenarioId;

    const evidenceList = await Evidence.find(filter)
      .sort({ timestamp: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      count: evidenceList.length,
      evidence: evidenceList,
    });
  } catch (err) {
    console.error('Error fetching evidence:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
