import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import ScenarioResult from '../../../models/ScenarioResult';
import { requireAuth } from '../../../lib/auth';

/**
 * GET /api/scenarios
 * Returns scenario inspection outcomes and compliance findings.
 */
export async function GET(request) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');
    const testRunId = searchParams.get('testRunId');
    const status = searchParams.get('status');

    const filter = {};
    if (assessmentId) filter.assessmentId = assessmentId;
    if (testRunId) filter.testRunId = testRunId;
    if (status) filter.status = status;

    const scenarios = await ScenarioResult.find(filter)
      .populate('evidenceIds', 'scenarioId evidenceType pageUrl screenshotPath extractedContent')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      success: true,
      count: scenarios.length,
      scenarios,
    });
  } catch (err) {
    console.error('Error fetching scenarios:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
