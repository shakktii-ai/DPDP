import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import Organization from '@/models/Organization';
import ApprovedTarget from '@/models/ApprovedTarget';
import AuditLog from '@/models/AuditLog';
import { getAuthSession, checkOrganizationAccess, ROLES } from '@/lib/auth';
import { validateTargetUrl } from '@/lib/security';
import { getAssessmentSummaries } from '@/lib/assessment-summary';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectToDatabase();
    const session = getAuthSession(request);
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId');

    const query = {};

    if (session) {
      if (
        session.role === ROLES.USER ||
        session.role === ROLES.ORGANIZATION_OWNER
      ) {
        // Enforce org scope restriction
        if (session.organizationId) {
          query.organization = session.organizationId;
        } else {
          return NextResponse.json({ success: true, data: [] });
        }
      } else if (orgId) {
        query.organization = orgId;
      }
    } else if (orgId) {
      query.organization = orgId;
    }

    const assessments = await Assessment.find(query)
      .populate('organization', 'name legalEntityName')
      .populate('previousAssessmentId', 'sequenceNumber status createdAt complianceScore')
      .sort({ createdAt: -1 })
      .lean();

    const summaries = await getAssessmentSummaries(assessments);
    const enriched = assessments.map((asm, idx) => {
      const summary = summaries[idx];
      return {
        ...asm,
        complianceScore: summary ? summary.complianceScore : asm.complianceScore,
        scoreDisplay: summary ? summary.scoreDisplay : (asm.complianceScore !== null ? `${asm.complianceScore}%` : 'Not calculated'),
        scoreStatus: summary ? summary.scoreStatus : 'unknown',
        counts: summary ? summary.counts : null,
        totalFindings: summary ? summary.totalFindings : 0,
        websiteName: summary ? summary.websiteName : asm.websiteName,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const session = getAuthSession(request);
    const body = await request.json();

    const {
      organizationId,
      targetUrl,
      websiteName,
      testMode,
      modelUsed,
      authorizationConfirmed,
      notes
    } = body;

    const targetOrgId = organizationId || session?.organizationId;
    if (!targetOrgId) {
      return NextResponse.json(
        { success: false, error: 'Target organization must be selected.' },
        { status: 400 }
      );
    }

    // Server-side authorization check
    if (session && !checkOrganizationAccess(session, targetOrgId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not have permission to launch assessments for this organization.' },
        { status: 403 }
      );
    }

    // SSRF and URL validation
    const urlCheck = validateTargetUrl(targetUrl);
    if (!urlCheck.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: `URL Security Check Failed: ${urlCheck.reason}`,
          securityNotice: 'SSRF mitigation blocked request.'
        },
        { status: 400 }
      );
    }

    if (!authorizationConfirmed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Explicit testing authorization is required under DPDP Act guidelines.'
        },
        { status: 400 }
      );
    }

    const org = await Organization.findById(targetOrgId);
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Specified organization was not found.' },
        { status: 404 }
      );
    }

    // Mandatory ApprovedTarget verification: Unapproved targets cannot be assessed!
    const approvedTarget = await ApprovedTarget.findOne({
      organization: targetOrgId,
      approvedDomain: urlCheck.domain,
      targetStatus: 'approved'
    });

    if (!approvedTarget) {
      // Audit log the unapproved attempt
      await AuditLog.create({
        action: 'ASSESSMENT_BLOCKED_UNAPPROVED_TARGET',
        category: 'security',
        actor: {
          userId: session?.userId || null,
          email: session?.email || 'unknown'
        },
        target: {
          entityType: 'Domain',
          identifier: urlCheck.domain
        },
        details: {
          organizationName: org.name,
          attemptedUrl: targetUrl,
          reason: 'Domain is not in ApprovedTarget registry'
        },
        status: 'failure'
      });

      return NextResponse.json(
        {
          success: false,
          error: `Unapproved target: The domain '${urlCheck.domain}' has not been approved for testing by ${org.name}. Please add it to your Approved Targets list before assessing.`,
          unapprovedDomain: urlCheck.domain
        },
        { status: 403 }
      );
    }

    const assessment = await Assessment.create({
      organization: targetOrgId,
      targetUrl: urlCheck.normalizedUrl,
      websiteName: websiteName || org.name,
      testMode: testMode || 'hybrid',
      modelUsed: modelUsed || process.env.GEMINI_MODEL || 'gemini-3.8-flash',
      status: 'queued',
      notes: notes || undefined,
      triggeredBy: session?.userId || null
    });

    // Write audit trail
    await AuditLog.create({
      action: 'ASSESSMENT_QUEUED',
      category: 'assessment',
      actor: {
        userId: session?.userId || null,
        email: session?.email || 'system'
      },
      target: {
        entityType: 'Assessment',
        entityId: assessment._id,
        identifier: urlCheck.normalizedUrl
      },
      details: {
        organizationName: org.name,
        targetDomain: urlCheck.domain,
        approvedTargetId: approvedTarget._id,
        testMode: assessment.testMode,
        modelRequested: assessment.modelUsed
      },
      status: 'success'
    });

    return NextResponse.json({ success: true, data: assessment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
