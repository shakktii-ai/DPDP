import { NextResponse } from 'next/server';
import connectDB from '../../../../lib/mongodb';
import TestRun from '../../../../models/TestRun';
import ApprovedTarget from '../../../../models/ApprovedTarget';
import Assessment from '../../../../models/Assessment';
import ScenarioResult from '../../../../models/ScenarioResult';
import Evidence from '../../../../models/Evidence';
import BrowserAction from '../../../../models/BrowserAction';
import StructuredObservation from '../../../../models/StructuredObservation';
import AuditLog from '../../../../models/AuditLog';
import { requireAuth } from '../../../../lib/auth';

/**
 * GET /api/runs/[id]
 * Retrieves live execution status, logs, scenario results, and evidence for a test run.
 */
export async function GET(request, { params }) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { id } = await params;

    const testRun = await TestRun.findById(id)
      .populate('targetId', 'approvedDomain targetUrl isDemoSite')
      .populate('assessmentId', 'assessmentName targetUrl status')
      .lean();

    if (!testRun) {
      return NextResponse.json({ success: false, error: 'Test run not found.' }, { status: 404 });
    }

    // Fetch associated scenario results
    const scenarioResults = await ScenarioResult.find({ testRunId: id })
      .populate('evidenceIds', 'scenarioId evidenceType pageUrl screenshotPath extractedContent')
      .sort({ createdAt: 1 })
      .lean();

    // Fetch evidence items
    const evidenceList = await Evidence.find({ testRunId: id })
      .select('scenarioId evidenceType pageUrl pageTitle screenshotPath metadata timestamp')
      .sort({ timestamp: 1 })
      .lean();

    // Fetch structured observations from Gemini Computer Use
    const observations = await StructuredObservation.find({ testRunId: id })
      .sort({ timestamp: 1 })
      .lean();

    // Fetch browser actions count/summary
    const actionCount = await BrowserAction.countDocuments({ testRunId: id });

    return NextResponse.json({
      success: true,
      testRun,
      scenarioResults,
      evidenceList,
      observations,
      actionCount,
    });
  } catch (err) {
    console.error('Error fetching test run details:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/runs/[id]
 * Handles interaction controls: cancel run or submit user assistance for OTP / CAPTCHA.
 */
export async function POST(request, { params }) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { action, assistanceData } = body;

    const testRun = await TestRun.findById(id);
    if (!testRun) {
      return NextResponse.json({ success: false, error: 'Test run not found.' }, { status: 404 });
    }

    if (action === 'cancel') {
      testRun.status = 'cancelled';
      testRun.errorMessage = 'Cancelled by user request.';
      testRun.endTime = new Date();
      testRun.logs.push({
        timestamp: new Date(),
        level: 'warn',
        message: `Run cancelled by ${session.name || session.email}.`,
      });
      await testRun.save();

      await AuditLog.create({
        action: 'test_run_cancelled',
        category: 'assessment',
        performedBy: session.userId,
        performedByName: session.name || session.email,
        targetResource: 'TestRun',
        resourceId: testRun._id,
        details: { runId: testRun._id },
        status: 'success',
      });

      return NextResponse.json({ success: true, message: 'Test run marked as cancelled.', testRun });
    }

    if (action === 'submit_assistance' || action === 'resume') {
      testRun.status = 'inspecting_website';
      testRun.userAssistanceRequired = false;
      testRun.userAssistanceData = assistanceData || { resumedBy: session.userId };
      testRun.logs.push({
        timestamp: new Date(),
        level: 'info',
        message: `Human assistance submitted / resumed by ${session.name || session.email}.`,
      });
      await testRun.save();

      return NextResponse.json({ success: true, message: 'Assistance acknowledged. Execution resuming.', testRun });
    }

    return NextResponse.json({ success: false, error: 'Invalid action specified.' }, { status: 400 });
  } catch (err) {
    console.error('Error modifying test run:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
