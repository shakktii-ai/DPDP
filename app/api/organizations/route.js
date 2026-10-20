import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Organization from '@/models/Organization';
import AuditLog from '@/models/AuditLog';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();
    const organizations = await Organization.find()
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: organizations });
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
    const body = await request.json();

    const {
      name,
      legalEntityName,
      industry,
      dpdpRegistrationNumber,
      dpoName,
      dpoEmail,
      dpoPhone,
      websiteName,
      websiteUrl,
      isAuthorized
    } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Organization name is required.' },
        { status: 400 }
      );
    }

    const registeredWebsites = [];
    if (websiteUrl && websiteUrl.trim() !== '') {
      registeredWebsites.push({
        name: websiteName && websiteName.trim() !== '' ? websiteName.trim() : name.trim(),
        url: websiteUrl.trim(),
        isAuthorized: Boolean(isAuthorized),
        authorizedAt: isAuthorized ? new Date() : null,
        scopeDescription: 'Authorized for automated DPDP Digital Personal Data Protection compliance assessment'
      });
    }

    const organization = await Organization.create({
      name: name.trim(),
      legalEntityName: legalEntityName ? legalEntityName.trim() : undefined,
      industry: industry || 'SaaS & Cloud Services',
      dpdpRegistrationNumber: dpdpRegistrationNumber ? dpdpRegistrationNumber.trim() : undefined,
      dataProtectionOfficer: {
        name: dpoName ? dpoName.trim() : undefined,
        email: dpoEmail ? dpoEmail.trim() : undefined,
        phone: dpoPhone ? dpoPhone.trim() : undefined
      },
      registeredWebsites,
      status: 'active'
    });

    // Write audit trail
    await AuditLog.create({
      action: 'ORGANIZATION_REGISTERED',
      category: 'organization',
      target: {
        entityType: 'Organization',
        entityId: organization._id,
        identifier: organization.name
      },
      details: {
        industry: organization.industry,
        websitesCount: registeredWebsites.length,
        hasDpo: Boolean(dpoEmail)
      },
      status: 'success'
    });

    return NextResponse.json({ success: true, data: organization }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
