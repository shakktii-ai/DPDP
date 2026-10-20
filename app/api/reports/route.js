import { NextResponse } from 'next/server';
import connectDB from '../../../lib/mongodb.js';
import Assessment from '../../../models/Assessment.js';
import Organization from '../../../models/Organization.js';
import Finding from '../../../models/Finding.js';
import { requireAuth, ROLES } from '../../../lib/auth.js';
import { generatePdfReport, generateExcelReport } from '../../../lib/report-generator.js';
import { evaluateAssessmentFindings } from '../../../lib/assessment-engine.js';
import { getAssessmentSummary, getAssessmentSummaries } from '../../../lib/assessment-summary.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports
 * Generates and streams PDF / Excel reports or lists standardized assessment summaries.
 */
export async function GET(request) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(request.url);
    const assessmentId = searchParams.get('assessmentId');
    const format = searchParams.get('format')?.toLowerCase();

    const isPlatformAdmin = session.role === 'admin' || session.role === ROLES.PLATFORM_ADMINISTRATOR;

    // 1. Binary PDF or Excel Download
    if (assessmentId && (format === 'pdf' || format === 'excel')) {
      const targetAssessment = await Assessment.findById(assessmentId);
      if (!targetAssessment) {
        return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
      }

      if (
        !isPlatformAdmin &&
        session.organizationId &&
        String(targetAssessment.organization) !== String(session.organizationId)
      ) {
        return NextResponse.json(
          { success: false, error: 'Forbidden. You do not have access to this organization report.' },
          { status: 403 }
        );
      }

      // Ensure findings exist for this assessment; if not, trigger evaluation
      const existingFindings = await Finding.countDocuments({ assessment: assessmentId });
      if (existingFindings === 0 && targetAssessment.status === 'completed') {
        await evaluateAssessmentFindings(assessmentId);
      }

      if (format === 'pdf') {
        const pdfBuffer = await generatePdfReport(assessmentId);
        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="DPDP-Assessment-Report-${assessmentId.slice(-6)}.pdf"`,
            'Content-Length': String(pdfBuffer.length),
          },
        });
      }

      if (format === 'excel') {
        const excelBuffer = await generateExcelReport(assessmentId);
        return new NextResponse(excelBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="DPDP-Assessment-Report-${assessmentId.slice(-6)}.xlsx"`,
            'Content-Length': String(excelBuffer.length),
          },
        });
      }
    }

    // 2. Specific Assessment Report Metadata
    if (assessmentId) {
      const assessment = await Assessment.findById(assessmentId)
        .populate('organization', 'name industry type dpoName dpoEmail');

      if (!assessment) {
        return NextResponse.json({ success: false, error: 'Assessment not found' }, { status: 404 });
      }

      if (
        !isPlatformAdmin &&
        session.organizationId &&
        String(assessment.organization?._id || assessment.organization) !== String(session.organizationId)
      ) {
        return NextResponse.json(
          { success: false, error: 'Forbidden. You do not have access to this organization report.' },
          { status: 403 }
        );
      }

      let findings = await Finding.find({ assessment: assessmentId }).sort({ createdAt: 1 });
      if (findings.length === 0 && assessment.status === 'completed') {
        const evalResult = await evaluateAssessmentFindings(assessmentId);
        findings = evalResult.findings;
      }

      const summary = await getAssessmentSummary(assessment);

      return NextResponse.json({
        success: true,
        report: {
          ...summary,
          assessment,
          organization: assessment.organization,
          target: { url: summary.targetUrl, name: summary.websiteName },
          findings,
          isFinal: assessment.status === 'completed',
        },
      });
    }

    // 3. List all assessments available for reporting (One Source of Truth)
    const query = (!isPlatformAdmin && session.organizationId) ? { organization: session.organizationId } : {};
    const reportsList = await getAssessmentSummaries(query);

    return NextResponse.json({
      success: true,
      reports: reportsList,
    });
  } catch (err) {
    console.error('Error in reports route:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
