import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Organization from '@/models/Organization';
import ApprovedTarget from '@/models/ApprovedTarget';
import AssessmentDocument from '@/models/AssessmentDocument';
import AssessmentProfile from '@/models/AssessmentProfile';
import AuditLog from '@/models/AuditLog';
import { getAuthSession, checkOrganizationAccess, ROLES } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    await connectToDatabase();
    const session = getAuthSession(request);
    const { id } = await params;

    if (session && !checkOrganizationAccess(session, id)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Access to this organization is denied.' },
        { status: 403 }
      );
    }

    const [organization, targets, documents, profiles] = await Promise.all([
      Organization.findById(id).lean(),
      ApprovedTarget.find({ organization: id }).lean(),
      AssessmentDocument.find({ organization: id }).lean(),
      AssessmentProfile.find({ organization: id }).lean()
    ]);

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        organization,
        targets,
        documents,
        profiles
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    await connectToDatabase();
    const session = getAuthSession(request);
    const { id } = await params;

    // Access control: only platform_admin or organization_owner of this org can edit
    if (session) {
      if (
        session.role !== ROLES.PLATFORM_ADMINISTRATOR &&
        (!session.organizationId || String(session.organizationId) !== String(id))
      ) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: You do not have permission to edit this organization.' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const updated = await Organization.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Organization not found.' },
        { status: 404 }
      );
    }

    // Audit log
    await AuditLog.create({
      action: 'ORGANIZATION_UPDATED',
      category: 'organization',
      actor: {
        userId: session?.userId || null,
        email: session?.email || 'system'
      },
      target: {
        entityType: 'Organization',
        entityId: updated._id,
        identifier: updated.name
      },
      details: { updatedFields: Object.keys(body) },
      status: 'success'
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
