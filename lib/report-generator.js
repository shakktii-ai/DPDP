import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import connectDB from './mongodb.js';
import Assessment from '../models/Assessment.js';
import Organization from '../models/Organization.js';
import Finding from '../models/Finding.js';
import LegalRequirement from '../models/LegalRequirement.js';
import ScenarioResult from '../models/ScenarioResult.js';
import Evidence from '../models/Evidence.js';
import { computeAssessmentSummary } from './assessment-summary.js';

/**
 * Loads all related assessment data for reporting.
 */
async function loadReportData(assessmentId) {
  await connectDB();

  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }

  const organization = await Organization.findById(assessment.organization);
  const findings = await Finding.find({ assessment: assessment._id }).sort({
    // Sort severity critical -> high -> medium -> low -> informational
    createdAt: 1,
  });

  const legalRequirements = await LegalRequirement.find().lean();
  const reqMap = new Map(legalRequirements.map((r) => [r.requirementId, r]));

  const scenarioResults = await ScenarioResult.find({ assessmentId: assessment._id });
  const evidenceList = await Evidence.find({ assessmentId: assessment._id });

  // Use authoritative shared assessment summary
  const summary = computeAssessmentSummary({
    assessment,
    findings,
    scenarioResults,
    evidenceCount: evidenceList.length,
  });

  return {
    assessment,
    organization: organization || { name: 'Unassigned Organization', industry: 'General', contactEmail: '' },
    target: { url: summary.targetUrl, name: summary.websiteName },
    findings,
    reqMap,
    scenarioResults,
    evidenceList,
    counts: summary.counts,
    severityCounts: summary.severityCounts,
    calculatedScore: summary.complianceScore !== null ? summary.complianceScore : 0,
    scoreDisplay: summary.scoreDisplay,
    totalFindings: findings.length,
  };
}

/**
 * Generates an official PDF compliance assessment report.
 * 
 * @param {string} assessmentId
 * @returns {Promise<Buffer>}
 */
export async function generatePdfReport(assessmentId) {
  const data = await loadReportData(assessmentId);
  const { assessment, organization, target, findings, counts, severityCounts, calculatedScore } = data;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 45,
        size: 'A4',
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const primaryColor = '#0f172a'; // slate-900
      const accentCyan = '#0284c7';   // sky-600
      const successColor = '#16a34a'; // green-600
      const dangerColor = '#dc2626';  // red-600
      const warningColor = '#d97706'; // amber-600
      const neutralMuted = '#64748b'; // slate-500

      // ==========================================
      // PAGE 1: COVER PAGE
      // ==========================================
      doc.rect(0, 0, doc.page.width, 16).fill('#0ea5e9'); // Top accent banner
      doc.rect(0, 16, doc.page.width, 100).fill(primaryColor);

      doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold');
      doc.text('DPDP COMPLIANCE ASSESSMENT REPORT', 45, 45);
      doc.fontSize(10).font('Helvetica').fillColor('#94a3b8');
      doc.text('Statutory Audit under Digital Personal Data Protection Act, 2023 & DPDP Rules 2025', 45, 75);

      doc.moveDown(4);
      doc.y = 150;

      // Organization Box
      doc.roundedRect(45, doc.y, 505, 130, 8).stroke('#cbd5e1');
      const boxTop = doc.y;

      doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('ASSESSMENT PROFILE & TARGET SCOPE', 60, boxTop + 15);

      doc.font('Helvetica').fontSize(9).fillColor('#334155');
      doc.text(`Organization Name:  ${organization.name}`, 60, boxTop + 35);
      doc.text(`Industry / Sector:    ${organization.industry || 'Technology / Digital Services'}`, 60, boxTop + 50);
      doc.text(`Target URL:            ${target.url}`, 60, boxTop + 65);
      doc.text(`Assessment ID:         ${assessment._id}`, 60, boxTop + 80);
      doc.text(`Assessment Date:       ${new Date(assessment.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}`, 60, boxTop + 95);
      doc.text(`Evaluation Engine:     Playwright Browser Worker & Gemini Multi-Modal Agent`, 60, boxTop + 110);

      // Score Callout Card
      doc.y = boxTop + 150;
      doc.roundedRect(45, doc.y, 505, 95, 8).fill('#f8fafc').stroke('#e2e8f0');
      const scoreTop = doc.y;

      doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('STATUTORY COMPLIANCE INDEX', 60, scoreTop + 15);

      doc.fontSize(36).font('Helvetica-Bold').fillColor(calculatedScore >= 70 ? successColor : dangerColor);
      doc.text(`${calculatedScore}%`, 60, scoreTop + 35);

      doc.fontSize(9).font('Helvetica').fillColor(neutralMuted);
      doc.text(
        `Calculated over ${findings.length} evaluated statutory checkpoints. Pass: ${counts.pass} | Fail: ${counts.fail} | Needs Review: ${counts.needs_review} | N/A: ${counts.not_applicable}`,
        155,
        scoreTop + 45,
        { width: 380 }
      );

      // Mandatory Legal Aid Disclaimer
      doc.y = scoreTop + 115;
      doc.roundedRect(45, doc.y, 505, 110, 8).fill('#fffbeb').stroke('#fef3c7');
      const discTop = doc.y;

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#b45309');
      doc.text('REGULATORY NOTICE & ASSESSMENT AID DISCLAIMER', 60, discTop + 15);

      doc.fontSize(8.5).font('Helvetica').fillColor('#92400e').lineGap(2);
      doc.text(
        'This assessment report is an automated diagnostic aid designed to support Data Fiduciaries in evaluating website readiness against the Digital Personal Data Protection Act, 2023 and the DPDP Rules, 2025. This document DOES NOT constitute government certification, legal representation, or a statutory guarantee of immunity from regulatory enforcement by the Data Protection Board of India (DPBI). Technical observations are empirical and limited to client-side automated inspection.',
        60,
        discTop + 35,
        { width: 475 }
      );

      // Cover Page Footer
      doc.fontSize(8).font('Helvetica').fillColor(neutralMuted);
      doc.text('Official Reference: Ministry of Electronics and Information Technology (MeitY) — meity.gov.in/dpdp-rules-2025', 45, 780);

      // ==========================================
      // PAGE 2: EXECUTIVE SUMMARY & METHODOLOGY
      // ==========================================
      doc.addPage();
      doc.rect(45, 45, 505, 4).fill(accentCyan);
      doc.y = 55;

      doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('1. Executive Summary & Audit Methodology', 45, 55);
      doc.moveDown(0.8);

      doc.fontSize(9.5).font('Helvetica').fillColor('#334155').lineGap(3);
      doc.text(
        `On ${new Date(assessment.createdAt).toLocaleDateString()}, an evidence-based DPDP evaluation was executed against ${target.url}. The testing pipeline engaged automated browser sandboxes (Playwright Chromium) and Gemini analytical interpretation to verify statutory disclosures, affirmative consent mechanisms, grievance redressal pathways, and credential safeguards.`
      );
      doc.moveDown(0.8);

      // Findings Summary Table
      doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('1.1 Statutory Checkpoint Evaluation Breakdown');
      doc.moveDown(0.5);

      const tableHeaders = ['Evaluation Status', 'Count', 'Percentage of Total', 'Regulatory Implication'];
      const tableRows = [
        ['Passed', String(counts.pass), `${Math.round((counts.pass / findings.length) * 100 || 0)}%`, 'Compliant technical control observed'],
        ['Failed', String(counts.fail), `${Math.round((counts.fail / findings.length) * 100 || 0)}%`, 'Statutory violation / Non-conformity'],
        ['Needs Review', String(counts.needs_review), `${Math.round((counts.needs_review / findings.length) * 100 || 0)}%`, 'Ambiguous disclosure / Requires legal confirmation'],
        ['Not Applicable', String(counts.not_applicable), `${Math.round((counts.not_applicable / findings.length) * 100 || 0)}%`, 'Trigger capability not present on website'],
        ['Not Tested', String(counts.not_tested), `${Math.round((counts.not_tested / findings.length) * 100 || 0)}%`, 'External organizational evidence required'],
      ];

      let tableY = doc.y;
      doc.rect(45, tableY, 505, 20).fill('#f1f5f9');
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b');
      doc.text(tableHeaders[0], 55, tableY + 5);
      doc.text(tableHeaders[1], 160, tableY + 5);
      doc.text(tableHeaders[2], 215, tableY + 5);
      doc.text(tableHeaders[3], 320, tableY + 5);

      tableY += 20;
      doc.font('Helvetica').fontSize(8.5);
      for (const row of tableRows) {
        doc.rect(45, tableY, 505, 18).stroke('#e2e8f0');
        doc.fillColor('#0f172a').text(row[0], 55, tableY + 5);
        doc.text(row[1], 160, tableY + 5);
        doc.text(row[2], 215, tableY + 5);
        doc.fillColor(neutralMuted).text(row[3], 320, tableY + 5);
        tableY += 18;
      }

      doc.y = tableY + 20;

      // Methodology Section
      doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('1.2 Assessment Methodology & Evidence Standards');
      doc.moveDown(0.5);

      doc.fontSize(9).font('Helvetica').fillColor('#334155').lineGap(2);
      doc.text('• Deterministic DOM Verification: Direct element selectors, HTTPS cipher flags, and form attribute analysis.');
      doc.text('• Empirical Evidence Isolation: Technical website observations are strictly recorded separately from AI interpretations.');
      doc.text('• Gemini Multi-Modal Interpretation: Evaluates clarity, language transparency, and dark patterns without fabricating facts.');
      doc.text('• Non-Assumption Principle: Absence of evidence is NEVER marked as compliant (marked as Needs Review or Failed).');
      doc.text('• Enforceability Filtering: Only gazetted provisions of the DPDP Act 2023 and DPDP Rules 2025 are evaluated as binding.');

      // ==========================================
      // PAGE 3: DETAILED STATUTORY FINDINGS
      // ==========================================
      doc.addPage();
      doc.rect(45, 45, 505, 4).fill(accentCyan);
      doc.y = 55;

      doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('2. Traceable Statutory Findings & Evidence', 45, 55);
      doc.moveDown(0.8);

      for (let i = 0; i < findings.length; i++) {
        const f = findings[i];

        // Check if page overflow
        if (doc.y > 660) {
          doc.addPage();
          doc.y = 55;
        }

        const findingStartY = doc.y;
        const statusBg =
          f.status === 'pass'
            ? '#ecfdf5'
            : f.status === 'fail'
            ? '#fef2f2'
            : f.status === 'needs_review'
            ? '#fffbeb'
            : '#f8fafc';

        const statusBorder =
          f.status === 'pass'
            ? '#a7f3d0'
            : f.status === 'fail'
            ? '#fecaca'
            : f.status === 'needs_review'
            ? '#fde68a'
            : '#e2e8f0';

        doc.roundedRect(45, findingStartY, 505, 125, 6).fill(statusBg).stroke(statusBorder);

        // Header line
        doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor);
        doc.text(`${f.requirementId} — ${f.ruleId}: ${f.title}`, 55, findingStartY + 10, { width: 380 });

        // Status badge
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor(
          f.status === 'pass' ? successColor : f.status === 'fail' ? dangerColor : warningColor
        );
        doc.text(f.status.toUpperCase().replace(/_/g, ' '), 440, findingStartY + 10, { align: 'right', width: 100 });

        // Severity
        doc.fontSize(8).font('Helvetica').fillColor(neutralMuted);
        doc.text(`Severity: ${f.severity.toUpperCase()}  |  Category: ${f.category}`, 55, findingStartY + 25);

        // Observed Facts vs AI interpretation
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e293b');
        doc.text('Empirical Observed Facts:', 55, findingStartY + 40);
        doc.font('Helvetica').fillColor('#334155');
        const factText = f.observedFacts && f.observedFacts.length > 0 ? f.observedFacts.join('; ') : 'None recorded';
        doc.text(factText.slice(0, 160) + (factText.length > 160 ? '...' : ''), 175, findingStartY + 40, { width: 365 });

        doc.font('Helvetica-Bold').fillColor('#1e293b');
        doc.text('AI Statutory Interpretation:', 55, findingStartY + 65);
        doc.font('Helvetica').fillColor('#334155');
        const interpText = f.aiInterpretation || f.explanation || 'N/A';
        doc.text(interpText.slice(0, 160) + (interpText.length > 160 ? '...' : ''), 175, findingStartY + 65, { width: 365 });

        // Recommended Remediation
        doc.font('Helvetica-Bold').fillColor('#1e293b');
        doc.text('Recommended Action:', 55, findingStartY + 90);
        doc.font('Helvetica').fillColor('#0284c7');
        const remText = f.recommendedRemediation || 'No action needed.';
        doc.text(remText.slice(0, 160) + (remText.length > 160 ? '...' : ''), 175, findingStartY + 90, { width: 365 });

        // Remediation & Reviewer status footer
        doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(neutralMuted);
        const reviewText = `Reviewer Decision: ${f.reviewerDecision || 'pending'} | Remediation: ${f.remediationStatus || 'open'}${
          f.assignedTo ? ` (Assigned: ${f.assignedTo})` : ''
        }`;
        doc.text(reviewText, 55, findingStartY + 112);

        doc.y = findingStartY + 135;
      }

      // ==========================================
      // PAGE 4: REMEDIATION ROADMAP & LIMITATIONS
      // ==========================================
      doc.addPage();
      doc.rect(45, 45, 505, 4).fill(accentCyan);
      doc.y = 55;

      doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('3. Remediation Roadmap & Organizational Evidence', 45, 55);
      doc.moveDown(0.8);

      doc.fontSize(9.5).font('Helvetica').fillColor('#334155').lineGap(2);
      doc.text(
        'The following priority actions are required to align digital processing activities with the DPDP Act 2023. Corrective actions should be tracked in the platform remediation board until verified resolved.'
      );
      doc.moveDown(0.8);

      const openRemediations = findings.filter((f) => f.remediationStatus === 'open' || f.status === 'fail');
      if (openRemediations.length === 0) {
        doc.fontSize(9.5).font('Helvetica-Bold').fillColor(successColor);
        doc.text('No critical open remediations detected. Maintain ongoing compliance checks.');
      } else {
        for (const rem of openRemediations.slice(0, 5)) {
          doc.fontSize(9).font('Helvetica-Bold').fillColor(dangerColor);
          doc.text(`[${rem.severity.toUpperCase()}] ${rem.ruleId}: ${rem.title}`);
          doc.font('Helvetica').fontSize(8.5).fillColor('#334155');
          doc.text(`Action: ${rem.recommendedRemediation}`);
          if (rem.assignedTo) {
            doc.text(`Owner: ${rem.assignedTo} | Due: ${rem.dueDate ? new Date(rem.dueDate).toLocaleDateString() : 'Unscheduled'}`);
          }
          doc.moveDown(0.5);
        }
      }

      doc.moveDown(1.5);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('3.1 Items Requiring Offline Organizational Evidence');
      doc.moveDown(0.4);

      doc.fontSize(8.5).font('Helvetica').fillColor('#334155').lineGap(2);
      doc.text('1. DPO Designation: Board resolution or formal appointment of Data Protection Officer under Section 10.');
      doc.text('2. Periodic Data Audit: External independent audit records and Data Protection Impact Assessment (DPIA).');
      doc.text('3. Vendor / Processor Contracts: Data Processing Agreements (DPAs) enforcing DPDP requirements with cloud providers.');
      doc.text('4. Data Retention Logs: Automated database purging schedules demonstrating deletion upon purpose completion.');

      doc.moveDown(1.5);
      doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor);
      doc.text('3.2 Assessment Scope & Technical Limitations');
      doc.moveDown(0.4);

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').lineGap(2);
      doc.text('• Scope: Automated inspection is confined strictly to publicly rendered HTML/JS interfaces and user-supplied profiles.');
      doc.text('• Backend Exclusions: Internal databases, encrypted queues, telemetry pipelines, and employees were not inspected.');
      doc.text('• Dynamic Content: Workflows requiring two-factor SMS OTP or biometric verification require manual testing.');
      doc.text('• Non-Endorsement: This automated evaluation does not certify compliance with foreign laws (GDPR, CCPA).');

      // Final Footer on all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let p = 0; p < totalPages; p++) {
        doc.switchToPage(p);
        doc.fontSize(7.5).font('Helvetica').fillColor(neutralMuted);
        doc.text(
          `Page ${p + 1} of ${totalPages}  |  DPDP Act 2023 & DPDP Rules 2025 Audit Aid  |  ${organization.name}`,
          45,
          810,
          { align: 'center', width: 505 }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates an official multi-tab Excel compliance report.
 * 
 * @param {string} assessmentId
 * @returns {Promise<Buffer>}
 */
export async function generateExcelReport(assessmentId) {
  const data = await loadReportData(assessmentId);
  const { assessment, organization, target, findings, counts, calculatedScore } = data;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DPDP Automated Assessment Platform';
  workbook.lastModifiedBy = 'DPDP Evidence Engine';
  workbook.created = new Date();

  // ==========================================
  // SHEET 1: EXECUTIVE SUMMARY
  // ==========================================
  const summarySheet = workbook.addWorksheet('Executive Summary', {
    views: [{ showGridLines: true }],
  });

  summarySheet.columns = [
    { header: 'Metric / Parameter', key: 'parameter', width: 32 },
    { header: 'Value', key: 'value', width: 50 },
    { header: 'Notes / Context', key: 'notes', width: 40 },
  ];

  // Header styling
  const headerRow = summarySheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };

  summarySheet.addRows([
    { parameter: 'Organization Name', value: organization.name, notes: 'Evaluated Data Fiduciary' },
    { parameter: 'Industry', value: organization.industry || 'Technology', notes: 'Sectoral Classification' },
    { parameter: 'Target Website URL', value: target.url, notes: 'Primary In-Scope Web Asset' },
    { parameter: 'Assessment Date', value: new Date(assessment.createdAt).toISOString(), notes: 'Timestamp of Audit Run' },
    { parameter: 'Statutory Compliance Score', value: `${calculatedScore}%`, notes: 'Pass / (Pass + Fail + NeedsReview)' },
    { parameter: 'Total Evaluated Checkpoints', value: findings.length, notes: 'Applicable & Universal Provisions' },
    { parameter: 'Passed Requirements', value: counts.pass, notes: 'Compliant Controls Verified' },
    { parameter: 'Failed Requirements', value: counts.fail, notes: 'Corrective Action Required' },
    { parameter: 'Needs Review Requirements', value: counts.needs_review, notes: 'Human Legal Confirmation Needed' },
    { parameter: 'Not Applicable Requirements', value: counts.not_applicable, notes: 'Triggers Not Active on Site' },
    { parameter: 'Not Tested (External Evidence)', value: counts.not_tested, notes: 'Awaiting Offline Documents' },
    {
      parameter: 'Statutory Disclaimer',
      value: 'Assessment aid only — Not a government certification or guarantee of DPBI compliance.',
      notes: 'Digital Personal Data Protection Act, 2023',
    },
  ]);

  // ==========================================
  // SHEET 2: DETAILED FINDINGS
  // ==========================================
  const findingsSheet = workbook.addWorksheet('Detailed Findings', {
    views: [{ showGridLines: true }],
  });

  findingsSheet.columns = [
    { header: 'Requirement ID', key: 'reqId', width: 28 },
    { header: 'Statutory Ref', key: 'ruleId', width: 16 },
    { header: 'Title', key: 'title', width: 35 },
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Severity', key: 'severity', width: 14 },
    { header: 'Observed Facts (Technical)', key: 'facts', width: 45 },
    { header: 'AI Interpretation', key: 'ai', width: 45 },
    { header: 'Recommended Remediation', key: 'remediation', width: 45 },
    { header: 'Reviewer Decision', key: 'reviewDecision', width: 18 },
    { header: 'Reviewer Notes', key: 'reviewNotes', width: 30 },
    { header: 'Remediation Status', key: 'remStatus', width: 18 },
    { header: 'Assigned To', key: 'assignedTo', width: 22 },
    { header: 'Due Date', key: 'dueDate', width: 14 },
  ];

  const fHeaderRow = findingsSheet.getRow(1);
  fHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  fHeaderRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0284C7' },
  };

  findings.forEach((f) => {
    findingsSheet.addRow({
      reqId: f.requirementId,
      ruleId: f.ruleId,
      title: f.title,
      category: f.category,
      status: f.status.toUpperCase(),
      severity: f.severity.toUpperCase(),
      facts: (f.observedFacts || []).join('; '),
      ai: f.aiInterpretation || f.explanation,
      remediation: f.recommendedRemediation,
      reviewDecision: f.reviewerDecision || 'pending',
      reviewNotes: f.reviewerNotes || '',
      remStatus: f.remediationStatus || 'open',
      assignedTo: f.assignedTo || 'Unassigned',
      dueDate: f.dueDate ? new Date(f.dueDate).toLocaleDateString() : '',
    });
  });

  // ==========================================
  // SHEET 3: EVIDENCE & SCENARIO LOG
  // ==========================================
  const evidenceSheet = workbook.addWorksheet('Evidence & Scenario Log', {
    views: [{ showGridLines: true }],
  });

  evidenceSheet.columns = [
    { header: 'Scenario ID', key: 'scenarioId', width: 30 },
    { header: 'Title', key: 'title', width: 35 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'DPDP Reference', key: 'dpdpRef', width: 20 },
    { header: 'Observed Findings', key: 'findings', width: 50 },
    { header: 'Screenshot Reference', key: 'screenshot', width: 40 },
  ];

  const evHeader = evidenceSheet.getRow(1);
  evHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  evHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' },
  };

  data.scenarioResults.forEach((sc) => {
    evidenceSheet.addRow({
      scenarioId: sc.scenarioId,
      title: sc.title,
      status: sc.status.toUpperCase(),
      dpdpRef: sc.dpdpReference || '',
      findings: (sc.observedFindings || []).join('; '),
      screenshot: sc.evidenceIds && sc.evidenceIds[0]?.screenshotPath ? sc.evidenceIds[0].screenshotPath : 'N/A',
    });
  });

  // ==========================================
  // SHEET 4: REMEDIATION ACTION PLAN
  // ==========================================
  const remSheet = workbook.addWorksheet('Remediation Tracker', {
    views: [{ showGridLines: true }],
  });

  remSheet.columns = [
    { header: 'Requirement ID', key: 'reqId', width: 28 },
    { header: 'Section Ref', key: 'ruleId', width: 16 },
    { header: 'Title', key: 'title', width: 35 },
    { header: 'Severity', key: 'severity', width: 14 },
    { header: 'Remediation Status', key: 'remStatus', width: 18 },
    { header: 'Assigned Owner', key: 'assignedTo', width: 24 },
    { header: 'Owner Email', key: 'email', width: 26 },
    { header: 'Due Date', key: 'dueDate', width: 14 },
    { header: 'Corrective Action Notes', key: 'notes', width: 45 },
    { header: 'Retest History Count', key: 'retestCount', width: 18 },
  ];

  const remHeader = remSheet.getRow(1);
  remHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  remHeader.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF16A34A' },
  };

  findings.forEach((f) => {
    remSheet.addRow({
      reqId: f.requirementId,
      ruleId: f.ruleId,
      title: f.title,
      severity: f.severity.toUpperCase(),
      remStatus: f.remediationStatus.toUpperCase(),
      assignedTo: f.assignedTo || 'Unassigned',
      email: f.assignedEmail || '',
      dueDate: f.dueDate ? new Date(f.dueDate).toLocaleDateString() : '',
      notes: f.remediationNotes || f.recommendedRemediation,
      retestCount: (f.retestHistory || []).length,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
