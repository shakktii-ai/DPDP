import connectDB from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import TestRun from '@/models/TestRun';
import ApprovedTarget from '@/models/ApprovedTarget';
import Organization from '@/models/Organization';
import Evidence from '@/models/Evidence';
import ScenarioResult from '@/models/ScenarioResult';
import { requireAuth } from '@/lib/auth';
import { getAssessmentEvents, subscribeToAssessment, emitAssessmentEvent } from '@/lib/event-bus';

export const dynamic = 'force-dynamic';

/**
 * GET /api/assessments/[id]/stream
 * Live Server-Sent Events (SSE) stream for customer live browser testing.
 * Also supports JSON polling fallback when requested via Accept: application/json.
 */
export async function GET(request, { params }) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { id } = await params;

    // Locate assessment by ID, or fallback to finding by testRun ID
    let assessment = await Assessment.findById(id).lean();
    let testRun = null;

    if (!assessment) {
      testRun = await TestRun.findById(id).populate('targetId').lean();
      if (testRun && testRun.assessmentId) {
        assessment = await Assessment.findById(testRun.assessmentId).lean();
      }
    } else {
      testRun = await TestRun.findOne({ assessmentId: id })
        .populate('targetId', 'approvedDomain targetUrl isDemoSite')
        .sort({ createdAt: -1 })
        .lean();
    }

    if (!assessment && !testRun) {
      return new Response(JSON.stringify({ success: false, error: 'Assessment not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const orgId = assessment ? assessment.organization : testRun?.targetId?.organization;

    // Strict Tenant Isolation: Ensure customer owns this assessment
    if (session.role !== 'admin' && String(orgId) !== String(session.organizationId)) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized access to assessment stream.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const assessmentId = assessment ? String(assessment._id) : String(testRun.assessmentId);
    const runId = testRun ? String(testRun._id) : null;

    // Fetch initial catch-up data
    const evidenceFilter = runId
      ? { $or: [{ testRunId: runId }, { assessmentId }] }
      : { assessmentId };
    const scenarioFilter = runId
      ? { $or: [{ testRunId: runId }, { assessmentId }] }
      : { assessmentId };

    const [events, evidenceList, scenarios] = await Promise.all([
      getAssessmentEvents(assessmentId),
      Evidence.find(evidenceFilter)
        .select('scenarioId evidenceType pageUrl pageTitle screenshotPath metadata timestamp')
        .sort({ timestamp: 1 })
        .lean(),
      ScenarioResult.find(scenarioFilter)
        .select('scenarioId title category status summary dpdpReference observedFindings')
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    // Check if client expects standard JSON polling instead of SSE stream
    const acceptHeader = request.headers.get('accept') || '';
    const wantsJson = acceptHeader.includes('application/json') && !acceptHeader.includes('text/event-stream');

    if (wantsJson) {
      return new Response(
        JSON.stringify({
          success: true,
          assessment,
          testRun,
          events,
          evidenceList,
          scenarios,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Set up real-time Server-Sent Events stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        function sendMsg(obj) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
          } catch (e) {
            // Controller closed
          }
        }

        // 1. Send initial snapshot immediately upon connection
        sendMsg({
          type: 'init',
          assessment,
          testRun,
          events,
          evidenceList,
          scenarios,
        });

        // 2. Subscribe to real-time events from EventBus
        const unsubscribe = subscribeToAssessment(assessmentId, (event) => {
          sendMsg({
            type: 'event',
            event,
          });
        });

        // 3. Keep-alive heartbeat every 15s
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch (e) {
            clearInterval(pingInterval);
          }
        }, 15000);

        // 4. Cleanup when client disconnects
        request.signal.addEventListener('abort', () => {
          clearInterval(pingInterval);
          unsubscribe();
          try {
            controller.close();
          } catch (e) {}
        });
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('Error in assessment stream endpoint:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/assessments/[id]/stream
 * Allows customer to control assessment execution: pause, resume, cancel.
 */
export async function POST(request, { params }) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { id } = await params;
    const body = await request.json();
    const { action, assistanceData } = body;

    let assessment = await Assessment.findById(id);
    let testRun = null;

    if (!assessment) {
      testRun = await TestRun.findById(id);
      if (testRun && testRun.assessmentId) {
        assessment = await Assessment.findById(testRun.assessmentId);
      }
    } else {
      testRun = await TestRun.findOne({ assessmentId: id }).sort({ createdAt: -1 });
    }

    if (!assessment && !testRun) {
      return new Response(JSON.stringify({ success: false, error: 'Assessment not found.' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const orgId = assessment ? assessment.organization : null;
    if (session.role !== 'admin' && String(orgId) !== String(session.organizationId)) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const assessmentId = assessment ? assessment._id : testRun.assessmentId;
    const runId = testRun ? testRun._id : null;

    if (action === 'cancel' && testRun) {
      testRun.status = 'cancelled';
      testRun.errorMessage = 'Assessment cancelled by user.';
      testRun.endTime = new Date();
      await testRun.save();

      if (assessment) {
        assessment.status = 'cancelled';
        await assessment.save();
      }

      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'cancelled',
        title: 'Assessment Cancelled',
        description: `Assessment was stopped by ${session.name || session.email}.`,
      });

      return new Response(JSON.stringify({ success: true, message: 'Assessment cancelled.', testRun }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if ((action === 'resume' || action === 'submit_assistance') && testRun) {
      testRun.status = 'inspecting_website';
      testRun.userAssistanceRequired = false;
      testRun.userAssistanceData = assistanceData || { resumedBy: session.userId };
      await testRun.save();

      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'step_started',
        title: 'Inspection Resumed',
        description: `Assistance acknowledged by ${session.name || session.email}. Automated inspection resumed.`,
      });

      return new Response(JSON.stringify({ success: true, message: 'Assessment resumed.', testRun }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Unsupported action.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error modifying assessment stream:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
