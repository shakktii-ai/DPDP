import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb';
import TestRun from '../../../models/TestRun';
import ApprovedTarget from '../../../models/ApprovedTarget';
import Assessment from '../../../models/Assessment';
import AuditLog from '../../../models/AuditLog';
import { requireAuth } from '../../../lib/auth';
import { executeInspectionRun } from '../../../lib/browser-worker';
import { emitAssessmentEvent } from '../../../lib/event-bus';
import { redactSensitiveData } from '../../../lib/evidence-redactor';

/**
 * GET /api/runs
 * List test runs for an assessment or organization.
 */
export async function GET(request) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');
    const targetId = searchParams.get('targetId');

    const filter = {};
    if (assessmentId) filter.assessmentId = assessmentId;
    if (targetId) filter.targetId = targetId;

    const runs = await TestRun.find(filter)
      .populate('targetId', 'approvedDomain targetUrl isDemoSite')
      .populate('assessmentId', 'assessmentName targetUrl status')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({ success: true, count: runs.length, runs });
  } catch (err) {
    console.error('Error fetching test runs:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/runs
 * Queues a new automated Playwright inspection run on an approved target.
 */
export async function POST(request) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const body = await request.json();
    const { assessmentId, targetId, options = {} } = body;

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: 'targetId is required to launch inspection.' },
        { status: 400 }
      );
    }

    // Verify ApprovedTarget exists and is approved
    const target = await ApprovedTarget.findById(targetId);
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Target domain not found.' },
        { status: 404 }
      );
    }

    if (target.targetStatus !== 'approved') {
      return NextResponse.json(
        { success: false, error: `Target status is ${target.targetStatus}. Only approved targets can be assessed.` },
        { status: 403 }
      );
    }

    // Verify target belongs to user's organization (unless admin)
    if (session.role !== 'admin' && String(target.organization) !== String(session.organizationId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Target belongs to a different organization.' },
        { status: 403 }
      );
    }

    // Link or create Assessment record if not supplied
    let assessment = null;
    if (assessmentId) {
      assessment = await Assessment.findById(assessmentId);
    } else {
      assessment = await Assessment.create({
        organization: target.organization,
        targetUrl: target.targetUrl,
        assessmentName: `DPDP Inspection - ${target.approvedDomain}`,
        status: 'in_progress',
        complianceScore: 0,
        createdBy: session.userId,
      });
    }

    // Determine whether authenticated testing was requested
    const isAuthRequested = Boolean(
      options.credentials?.enabled &&
      !options.credentials?.skipAuthenticatedTesting &&
      (options.credentials?.username || options.credentials?.authMethod === 'password')
    );

    // Create TestRun in queued state
    const testRun = await TestRun.create({
      assessmentId: assessment._id,
      targetId: target._id,
      status: 'queued',
      progress: 0,
      currentStep: 'Queued for Playwright browser inspection',
      maxPages: options.maxPages || 15,
      maxActions: options.maxActions || 50,
      timeoutSeconds: options.timeoutSeconds || 120,
      runOptions: options,
      authTestingResult: {
        status: isAuthRequested ? 'pending' : 'not_applicable',
        authMethod: options.credentials?.authMethod || null,
        loginUrl: options.credentials?.loginUrl || null,
        usernameMasked: options.credentials?.username ? redactSensitiveData(options.credentials.username) : null,
        sessionEstablished: false,
        details: isAuthRequested ? 'Queued for authenticated browser inspection' : null,
      },
    });

    await emitAssessmentEvent({
      assessmentId: assessment._id,
      testRunId: testRun._id,
      eventType: 'queued',
      title: 'Assessment Queued',
      description: `Test run queued for automated Playwright inspection on ${target.approvedDomain}`,
      progress: 0,
      stepName: 'Queued for Playwright browser inspection',
      url: target.targetUrl,
    });

    // Sanitize options for audit trail (strictly strip password)
    const sanitizedOptionsForAudit = {
      ...options,
      credentials: options.credentials ? {
        enabled: Boolean(options.credentials.enabled),
        authMethod: options.credentials.authMethod,
        loginUrl: options.credentials.loginUrl,
        username: options.credentials.username,
        skipAuthenticatedTesting: Boolean(options.credentials.skipAuthenticatedTesting),
      } : undefined,
      loginTestingConfig: undefined,
    };

    // Record audit log
    await AuditLog.create({
      action: 'test_run_initiated',
      category: 'assessment',
      performedBy: session.userId,
      performedByName: session.name || session.email,
      organization: target.organization,
      targetResource: 'TestRun',
      resourceId: testRun._id,
      details: {
        targetDomain: target.approvedDomain,
        targetUrl: target.targetUrl,
        runId: testRun._id,
        options: sanitizedOptionsForAudit,
      },
      status: 'success',
    });

    // In serverless environments (e.g. Vercel), do NOT run unawaited background browser processes.
    // Serverless containers freeze immediately on response return and lack Chromium binaries.
    // Instead, leave the run in 'queued' state for the persistent worker daemon to claim and execute.
    const isServerless = process.env.VERCEL === '1' || process.env.NEXT_RUNTIME === 'edge';
    if (!isServerless && process.env.AUTO_SPAWN_LOCAL_WORKER !== 'false') {
      executeInspectionRun(testRun._id, options).catch((workerErr) => {
        console.error(`[Local Worker Error for ${testRun._id}]:`, workerErr);
      });
    }

    return NextResponse.json({ success: true, testRun }, { status: 201 });
  } catch (err) {
    console.error('Error initiating test run:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
