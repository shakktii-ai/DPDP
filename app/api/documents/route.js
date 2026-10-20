import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import AssessmentDocument from '@/models/AssessmentDocument';
import AuditLog from '@/models/AuditLog';
import { getAuthSession, checkOrganizationAccess, ROLES } from '@/lib/auth';
import { validateTargetUrl, validateDocumentUpload } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    await connectToDatabase();
    const session = getAuthSession(request);
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('organizationId') || session?.organizationId;

    if (!orgId) {
      if (
        session?.role === ROLES.PLATFORM_ADMINISTRATOR ||
        session?.role === ROLES.ASSESSMENT_REVIEWER
      ) {
        const docs = await AssessmentDocument.find()
          .populate('organization', 'name')
          .sort({ createdAt: -1 })
          .lean();
        return NextResponse.json({ success: true, data: docs });
      }

      return NextResponse.json(
        { success: false, error: 'Organization ID is required.' },
        { status: 400 }
      );
    }

    if (session && !checkOrganizationAccess(session, orgId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Access to this organization documents is denied.' },
        { status: 403 }
      );
    }

    const docs = await AssessmentDocument.find({ organization: orgId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: docs });
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
      documentType,
      title,
      sourceType,
      url,
      fileName,
      mimeType,
      fileSize,
      fileContentText
    } = body;

    const targetOrgId = organizationId || session?.organizationId;
    if (!targetOrgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required.' },
        { status: 400 }
      );
    }

    if (session && !checkOrganizationAccess(session, targetOrgId)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Cannot upload documents to this organization.' },
        { status: 403 }
      );
    }

    if (!documentType || !title) {
      return NextResponse.json(
        { success: false, error: 'Document type and title are required.' },
        { status: 400 }
      );
    }

    // URL validation if URL source
    if (sourceType === 'url') {
      if (!url) {
        return NextResponse.json(
          { success: false, error: 'Document URL is required for URL sources.' },
          { status: 400 }
        );
      }
      const urlCheck = validateTargetUrl(url);
      if (!urlCheck.isValid) {
        return NextResponse.json(
          { success: false, error: `Invalid document URL: ${urlCheck.reason}` },
          { status: 400 }
        );
      }
    }

    // Upload validation if file upload source
    if (sourceType === 'upload') {
      const uploadCheck = validateDocumentUpload({
        name: fileName || title,
        size: fileSize || (fileContentText ? fileContentText.length : 0),
        type: mimeType || 'text/plain'
      });
      if (!uploadCheck.isValid) {
        return NextResponse.json(
          { success: false, error: uploadCheck.reason },
          { status: 400 }
        );
      }
    }

    const doc = await AssessmentDocument.create({
      organization: targetOrgId,
      documentType,
      title: title.trim(),
      sourceType: sourceType || 'url',
      url: sourceType === 'url' ? url.trim() : undefined,
      fileName: fileName ? fileName.trim() : undefined,
      mimeType: mimeType || (sourceType === 'url' ? 'text/html' : 'text/plain'),
      sizeBytes: fileSize || (fileContentText ? fileContentText.length : 0),
      extractedText: fileContentText ? fileContentText.slice(0, 100000) : undefined, // Safe text bounds
      textLength: fileContentText ? fileContentText.length : 0,
      uploadedBy: session?.userId || null
    });

    // Audit log
    await AuditLog.create({
      action: 'DOCUMENT_UPLOADED',
      category: 'document_upload',
      actor: {
        userId: session?.userId || null,
        email: session?.email || 'system'
      },
      target: {
        entityType: 'AssessmentDocument',
        entityId: doc._id,
        identifier: doc.title
      },
      details: {
        documentType: doc.documentType,
        sourceType: doc.sourceType,
        sizeBytes: doc.sizeBytes
      },
      status: 'success'
    });

    return NextResponse.json({ success: true, data: doc }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
