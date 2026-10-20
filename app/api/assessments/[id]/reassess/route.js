import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import TestRun from '@/models/TestRun';
import ApprovedTarget from '@/models/ApprovedTarget';
import AuditLog from '@/models/AuditLog';
import { requireAuth, ROLES } from '@/lib/auth';
import { executeInspectionRun } from '@/lib/browser-worker';
import { emitAssessmentEvent } from '@/lib/event-bus';
import { validateTargetUrl } from '@/lib/security';

export const dynamic = 'force-dynamic';

/**
 * POST /api/assessments/[id]/reassess
 * Creates a brand new Assessment and TestRun for the same website,
 * strictly preserving previous findings, reports, and evidence.
 */
export async function POST(request, { params }) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Assessment ID is required.' }, { status: 400 });
    }

    const prevAssessment = await Assessment.findById(id).populate('organization');
    if (!prevAssessment) {
      return NextResponse.json({ success: false, error: 'Assessment not found.' }, { status: 404 });
    }

    const targetOrgId = prevAssessment.organization?._id || prevAssessment.organization;

    // RBAC: Verify ownership (unless platform admin)
    const isPlatformAdmin = session.role === 'admin' || session.role === ROLES.PLATFORM_ADMINISTRATOR;
    if (!isPlatformAdmin && String(targetOrgId) !== String(session.organizationId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not have permission to reassess this website.' },
        { status: 403 }
      );
    }

    // Parse domain from target URL
    let parsedUrl;
    try {
      parsedUrl = new URL(prevAssessment.targetUrl);
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Malformed target URL.' }, { status: 400 });
    }
    const domain = parsedUrl.hostname;

    // Verify ApprovedTarget status is approved
    const approvedTarget = await ApprovedTarget.findOne({
      organization: targetOrgId,
      approvedDomain: domain,
      targetStatus: 'approved',
    });

    if (!approvedTarget) {
      return NextResponse.json(
        {
          success: false,
          error: `Target domain '${domain}' is not in approved status. Reassessment cannot proceed until domain is approved.`,
        },
        { status: 403 }
      );
    }

    // SSRF & Domain validation
    const isDemoSite = Boolean(approvedTarget.isDemoSite);
    const urlCheck = validateTargetUrl(prevAssessment.targetUrl, { allowDemoLocalhost: isDemoSite });
    if (!urlCheck.isValid) {
      return NextResponse.json(
        { success: false, error: `Invalid target URL: ${urlCheck.reason}` },
        { status: 400 }
      );
    }

    // Check for an active reassessment already running for this target to prevent duplicate clicks
    const existingActiveRun = await TestRun.findOne({
      targetId: approvedTarget._id,
      status: { $in: ['queued', 'starting_browser', 'inspecting_website', 'capturing_evidence'] },
    });

    if (existingActiveRun) {
      return NextResponse.json(
        {
          success: false,
          error: 'An automated assessment is already actively running for this website. Please wait for it to complete.',
          activeRunId: existingActiveRun._id,
          activeAssessmentId: existingActiveRun.assessmentId,
        },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { scopeConfig = {}, notes } = body;

    // Handle authentication configuration safely
    const isPublicOnly = scopeConfig.skipAuthenticatedTesting !== false;
    let authOptions = {
      enabled: false,
      authMethod: 'public_only',
      skipAuthenticatedTesting: true,
    };

    if (!isPublicOnly) {
      const loginUrl = (scopeConfig.testLoginUrl || '').trim();
      const username = (scopeConfig.testUsername || '').trim();
      const password = scopeConfig.testPassword || '';

      if (!loginUrl || !username || !password) {
        return NextResponse.json(
          {
            success: false,
            error: 'When authenticated testing is enabled, Login URL, Username, and Password are all required.',
          },
          { status: 400 }
        );
      }

      // Check login domain against approved domain
      try {
        const loginDomain = new URL(loginUrl).hostname.replace(/^www\./, '').toLowerCase();
        const baseTargetDomain = approvedTarget.approvedDomain.replace(/^www\./, '').toLowerCase();
        if (loginDomain !== baseTargetDomain && !loginDomain.endsWith(`.${baseTargetDomain}`)) {
          return NextResponse.json(
            {
              success: false,
              error: `Login URL domain '${loginDomain}' does not belong to authorized target '${approvedTarget.approvedDomain}'.`,
            },
            { status: 400 }
          );
        }
      } catch (e) {
        return NextResponse.json(
          { success: false, error: 'Invalid login page URL format.' },
          { status: 400 }
        );
      }

      authOptions = {
        enabled: true,
        authMethod: 'password',
        loginUrl,
        username,
        password, // passed in memory to worker, NEVER saved to database or logs
        skipAuthenticatedTesting: false,
      };
    }

    // Compute sequential run number based on previous assessment sequence
    const sequenceNumber = (prevAssessment.sequenceNumber || 1) + 1;

    // Create the NEW Assessment record
    const newAssessment = await Assessment.create({
      organization: targetOrgId,
      targetUrl: prevAssessment.targetUrl,
      websiteName: prevAssessment.websiteName,
      status: 'queued',
      modelUsed: prevAssessment.modelUsed || 'gemini-3.8-flash',
      testMode: prevAssessment.testMode || 'hybrid',
      previousAssessmentId: prevAssessment._id,
      rootAssessmentId: prevAssessment.rootAssessmentId || prevAssessment._id,
      sequenceNumber,
      isReassessment: true,
      scopeConfig: {
        skipAuthenticatedTesting: isPublicOnly,
        hasAuthTesting: !isPublicOnly,
        testLoginUrl: !isPublicOnly ? authOptions.loginUrl : null,
        testUsername: !isPublicOnly ? authOptions.username : null,
      },
      triggeredBy: session.userId || null,
      notes: notes || `Reassessment Run #${sequenceNumber} (rerun of assessment ${String(prevAssessment._id).slice(-8)})`,
    });

    // Create new TestRun record in queued state
    const testRun = await TestRun.create({
      assessmentId: newAssessment._id,
      targetId: approvedTarget._id,
      status: 'queued',
      progress: 0,
      currentStep: `Queued for automated Playwright reassessment (Run #${sequenceNumber})`,
      maxPages: 15,
      maxActions: 50,
      timeoutSeconds: 120,
    });

    // Record AuditLog without password
    await AuditLog.create({
      action: 'ASSESSMENT_REASSESSMENT_QUEUED',
      category: 'assessment',
      actor: {
        userId: session.userId || null,
        email: session.email || 'customer',
      },
      target: {
        entityType: 'Assessment',
        entityId: newAssessment._id,
        identifier: prevAssessment.targetUrl,
      },
      details: {
        newAssessmentId: newAssessment._id,
        previousAssessmentId: prevAssessment._id,
        sequenceNumber,
        targetDomain: urlCheck.domain,
        authMethod: authOptions.authMethod,
      },
      status: 'success',
    });

    // Emit initial queue event
    await emitAssessmentEvent({
      assessmentId: newAssessment._id,
      testRunId: testRun._id,
      eventType: 'queued',
      title: `Reassessment Queued (Run #${sequenceNumber})`,
      description: `Fresh reassessment initiated for ${urlCheck.domain}. Previous run #${prevAssessment.sequenceNumber || 1} report remains preserved.`,
      progress: 0,
      stepName: `Queued for Playwright reassessment (Run #${sequenceNumber})`,
      url: prevAssessment.targetUrl,
    });

    // In serverless environments (e.g. Vercel), do NOT run unawaited background browser processes.
    // Serverless containers freeze immediately on response return and lack Chromium binaries.
    // Instead, leave the reassessment in 'queued' state for the persistent worker daemon to claim.
    const isServerless = process.env.VERCEL === '1' || process.env.NEXT_RUNTIME === 'edge';
    if (!isServerless && process.env.AUTO_SPAWN_LOCAL_WORKER !== 'false') {
      executeInspectionRun(testRun._id, workerOptions).catch((workerErr) => {
        console.error(`[Local Reassessment Worker Error for ${testRun._id}]:`, workerErr);
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: `Reassessment Run #${sequenceNumber} initiated successfully.`,
        assessmentId: newAssessment._id,
        testRunId: testRun._id,
        sequenceNumber,
        previousAssessmentId: prevAssessment._id,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('Error initiating reassessment:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
