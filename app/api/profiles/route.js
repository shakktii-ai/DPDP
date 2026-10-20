import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import AssessmentProfile from '@/models/AssessmentProfile';
import ApprovedTarget from '@/models/ApprovedTarget';
import AuditLog from '@/models/AuditLog';
import { getAuthSession, checkOrganizationAccess } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectToDatabase();
    const session = getAuthSession(request);
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId') || session?.organizationId;

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required.' },
        { status: 400 }
      );
    }

    if (session && !checkOrganizationAccess(session, orgId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Access to this organization is denied.' },
        { status: 403 }
      );
    }

    const profiles = await AssessmentProfile.find({ organization: orgId })
      .populate('approvedTarget', 'approvedDomain targetUrl approvedScope targetStatus')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: profiles });
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
      approvedTargetId,
      websiteUrl,
      websitePurpose,
      websiteFeatures,
      otherFeaturesDescription,
      assessmentMode,
      loginWorkflowDetails,
      scopeSummary
    } = body;

    const targetOrgId = organizationId || session?.organizationId;
    if (!targetOrgId || !approvedTargetId || !websiteUrl) {
      return NextResponse.json(
        { success: false, error: 'Organization ID, Approved Target ID, and Website URL are required.' },
        { status: 400 }
      );
    }

    if (session && !checkOrganizationAccess(session, targetOrgId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Cannot configure profiles for this organization.' },
        { status: 403 }
      );
    }

    // Verify the ApprovedTarget exists and is approved
    const target = await ApprovedTarget.findById(approvedTargetId);
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'Approved target not found.' },
        { status: 404 }
      );
    }

    if (target.targetStatus !== 'approved') {
      return NextResponse.json(
        { success: false, error: `Target status is '${target.targetStatus}'. Only approved targets can have assessment profiles created.` },
        { status: 400 }
      );
    }

    const profile = await AssessmentProfile.create({
      organization: targetOrgId,
      approvedTarget: approvedTargetId,
      websiteUrl: websiteUrl.trim(),
      websitePurpose: websitePurpose ? websitePurpose.trim() : undefined,
      websiteFeatures: Array.isArray(websiteFeatures) ? websiteFeatures : [],
      otherFeaturesDescription: otherFeaturesDescription?.trim() || undefined,
      assessmentMode: assessmentMode || 'website_with_documents',
      loginWorkflowDetails: loginWorkflowDetails || undefined,
      scopeSummary: scopeSummary || undefined,
      status: 'ready_for_assessment',
      createdBy: session?.userId || null
    });

    // Audit log
    await AuditLog.create({
      action: 'ASSESSMENT_PROFILE_CREATED',
      category: 'profile_config',
      actor: {
        userId: session?.userId || null,
        email: session?.email || 'system'
      },
      target: {
        entityType: 'AssessmentProfile',
        entityId: profile._id,
        identifier: profile.websiteUrl
      },
      details: {
        mode: profile.assessmentMode,
        targetDomain: target.approvedDomain
      },
      status: 'success'
    });

    return NextResponse.json({ success: true, data: profile }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
