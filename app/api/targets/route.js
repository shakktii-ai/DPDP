import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import ApprovedTarget from '@/models/ApprovedTarget';
import Organization from '@/models/Organization';
import AuditLog from '@/models/AuditLog';
import { getAuthSession, checkOrganizationAccess, ROLES } from '@/lib/auth';
import { validateTargetUrl } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectToDatabase();
    const session = getAuthSession(request);
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId') || session?.organizationId;

    if (!orgId) {
      // If platform admin or reviewer without org filter, list all approved targets
      if (
        session?.role === ROLES.PLATFORM_ADMINISTRATOR ||
        session?.role === ROLES.ASSESSMENT_REVIEWER
      ) {
        const targets = await ApprovedTarget.find()
          .populate('organization', 'name industry')
          .sort({ createdAt: -1 })
          .lean();
        return NextResponse.json({ success: true, data: targets });
      }

      return NextResponse.json(
        { success: false, error: 'Organization ID is required.' },
        { status: 400 }
      );
    }

    // Access control check
    if (session && !checkOrganizationAccess(session, orgId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not have permission to view targets for this organization.' },
        { status: 403 }
      );
    }

    const targets = await ApprovedTarget.find({ organization: orgId })
      .populate('organization', 'name industry')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: targets });
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
      approvedScope,
      excludedPaths,
      authorizationConfirmation
    } = body;

    const targetOrgId = organizationId || session?.organizationId;
    if (!targetOrgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required.' },
        { status: 400 }
      );
    }

    // Access control check
    if (session && !checkOrganizationAccess(session, targetOrgId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: You do not have permission to modify targets for this organization.' },
        { status: 403 }
      );
    }

    // SSRF & URL validation
    const urlCheck = validateTargetUrl(targetUrl);
    if (!urlCheck.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: `URL Validation Failed: ${urlCheck.reason}`,
          securityNotice: 'SSRF mitigation blocked target address.'
        },
        { status: 400 }
      );
    }

    if (!authorizationConfirmation?.confirmed) {
      return NextResponse.json(
        { success: false, error: 'Explicit testing authorization confirmation is required.' },
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

    // Check if domain already approved for this org
    const existing = await ApprovedTarget.findOne({
      organization: targetOrgId,
      approvedDomain: urlCheck.domain
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Domain '${urlCheck.domain}' is already approved for this organization.` },
        { status: 409 }
      );
    }

    const approvedTarget = await ApprovedTarget.create({
      organization: targetOrgId,
      approvedDomain: urlCheck.domain,
      targetUrl: urlCheck.normalizedUrl,
      approvedScope: Array.isArray(approvedScope) && approvedScope.length > 0
        ? approvedScope
        : ['public_pages', 'cookie_consent_banners', 'tracking_scripts'],
      excludedPaths: Array.isArray(excludedPaths) ? excludedPaths : ['/admin'],
      authorizationConfirmation: {
        confirmed: true,
        confirmedBy: session?.userId || null,
        confirmedByName: authorizationConfirmation.confirmedByName || 'Authorized Representative',
        confirmedByDesignation: authorizationConfirmation.confirmedByDesignation || 'Officer',
        confirmedAt: new Date()
      },
      targetStatus: 'approved',
      ssrfValidated: true,
      ssrfValidatedAt: new Date(),
      createdBy: session?.userId || null
    });

    // Also register in organization registeredWebsites if not present
    const hasWebsite = org.registeredWebsites.some((w) => w.url === urlCheck.normalizedUrl);
    if (!hasWebsite) {
      org.registeredWebsites.push({
        name: `${urlCheck.domain} Target`,
        url: urlCheck.normalizedUrl,
        isAuthorized: true,
        authorizedAt: new Date(),
        authorizedBy: session?.userId || null,
        scopeDescription: 'Explicitly approved target domain'
      });
      await org.save();
    }

    // Audit log
    await AuditLog.create({
      action: 'TARGET_APPROVED',
      category: 'target_approval',
      actor: {
        userId: session?.userId || null,
        email: session?.email || 'system'
      },
      target: {
        entityType: 'ApprovedTarget',
        entityId: approvedTarget._id,
        identifier: urlCheck.domain
      },
      details: {
        organizationName: org.name,
        targetUrl: approvedTarget.targetUrl,
        scope: approvedTarget.approvedScope
      },
      status: 'success'
    });

    return NextResponse.json({ success: true, data: approvedTarget }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
