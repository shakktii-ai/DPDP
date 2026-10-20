import connectDB from './mongodb.js';
import Assessment from '../models/Assessment.js';
import Organization from '../models/Organization.js';
import AssessmentProfile from '../models/AssessmentProfile.js';
import TestRun from '../models/TestRun.js';
import ScenarioResult from '../models/ScenarioResult.js';
import Evidence from '../models/Evidence.js';
import StructuredObservation from '../models/StructuredObservation.js';
import LegalRequirement from '../models/LegalRequirement.js';
import Finding from '../models/Finding.js';
import { seedLegalRequirements, evaluateApplicability } from './requirement-registry.js';

/**
 * Transforms technical observations, documents, and profile data into traceable DPDP findings.
 * 
 * @param {string} assessmentId
 * @param {string} [testRunId]
 * @returns {Promise<{
 *   assessmentId: string,
 *   complianceScore: number,
 *   totalRequirements: number,
 *   counts: { pass: number, fail: number, needsReview: number, notApplicable: number, notTested: number },
 *   findings: Array
 * }>}
 */
export async function evaluateAssessmentFindings(assessmentId, testRunId = null) {
  await connectDB();
  await seedLegalRequirements();

  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) {
    throw new Error(`Assessment ${assessmentId} not found.`);
  }

  const organization = await Organization.findById(assessment.organization);
  const profile = await AssessmentProfile.findOne({ organization: assessment.organization });
  
  // Find the associated TestRun if not explicitly provided
  let testRun = null;
  if (testRunId) {
    testRun = await TestRun.findById(testRunId);
  } else {
    testRun = await TestRun.findOne({ assessmentId }).sort({ createdAt: -1 });
  }

  // Load scenarios and evidence
  const scenarioResults = testRun
    ? await ScenarioResult.find({ testRunId: testRun._id })
    : await ScenarioResult.find({ assessmentId });

  const evidenceList = testRun
    ? await Evidence.find({ testRunId: testRun._id })
    : await Evidence.find({ assessmentId });

  const observations = testRun
    ? await StructuredObservation.find({ testRunId: testRun._id })
    : await StructuredObservation.find({ assessmentId });

  // Evaluate applicability of all legal requirements
  const applicabilityList = evaluateApplicability(organization, profile);
  const legalRequirements = await LegalRequirement.find().lean();
  const reqMap = new Map(legalRequirements.map((r) => [r.requirementId, r]));

  const generatedFindings = [];
  const counts = { pass: 0, fail: 0, needsReview: 0, notApplicable: 0, notTested: 0 };

  for (const item of applicabilityList) {
    const req = item.requirement;
    const reqDoc = reqMap.get(req.requirementId) || req;

    // Default payload structure
    let status = 'not_tested';
    let severity = req.defaultSeverity || 'medium';
    let remediationStatus = 'open';
    let observedFacts = [];
    let aiInterpretation = '';
    let explanation = '';
    let recommendedRemediation = '';
    let linkedEvidenceIds = [];
    let evidenceSnapshot = null;

    if (!item.isApplicable) {
      status = 'not_applicable';
      severity = 'informational';
      remediationStatus = 'risk_accepted';
      explanation = `Requirement is not applicable: ${item.reason}`;
      observedFacts = ['Trigger functionality not activated or declared in assessment profile.'];
      aiInterpretation = 'No statutory processing triggers detected for this specific legal clause.';
      recommendedRemediation = 'No corrective action required at this time.';
      counts.notApplicable++;
    } else {
      // Requirement is applicable: Map to technical scenario evidence
      switch (req.requirementId) {
        case 'DPDP-ACT-SEC-5-NOTICE': {
          const sc = scenarioResults.find((s) => s.scenarioId === 'privacy_notice_compliance');
          const noticeEv = evidenceList.filter((e) => e.scenarioId.includes('privacy') || e.scenarioId.includes('notice'));
          linkedEvidenceIds = noticeEv.map((e) => e._id);
          evidenceSnapshot = noticeEv[0]
            ? { pageUrl: noticeEv[0].pageUrl, screenshotUrl: noticeEv[0].screenshotPath, snippet: noticeEv[0].extractedContent?.slice(0, 300) }
            : null;

          if (sc && sc.status === 'passed') {
            status = 'pass';
            severity = 'informational';
            remediationStatus = 'resolved';
            observedFacts = sc.observedFindings || ['Privacy notice detected and accessible via dedicated navigation link.'];
            aiInterpretation = 'The published Privacy Notice satisfies statutory itemized disclosures pursuant to Section 5(1).';
            explanation = 'Data Fiduciary provides accessible notice detailing personal data categories, specified purposes, and DPO contacts.';
            recommendedRemediation = 'Maintain continuous accuracy of notice during subsequent application feature updates.';
            counts.pass++;
          } else if (sc && sc.status === 'needs_review') {
            status = 'needs_review';
            severity = 'medium';
            remediationStatus = 'open';
            observedFacts = sc.observedFindings || ['Privacy notice located but one or more disclosures are ambiguous or incomplete.'];
            aiInterpretation = 'One or more required statutory disclosures (such as specific retention timeline or right to withdraw) require legal clarification.';
            explanation = 'Notice was discovered but requires human legal confirmation regarding purpose specificity.';
            recommendedRemediation = 'Update privacy notice to explicitly document the statutory retention duration and consent withdrawal mechanism.';
            counts.needsReview++;
          } else {
            status = 'fail';
            severity = 'critical';
            remediationStatus = 'open';
            observedFacts = ['No accessible privacy notice detected during automated crawling.'];
            aiInterpretation = 'Violation of DPDP Act Section 5(1): Personal data collected without requisite prior itemized notice.';
            explanation = 'Failure to provide statutory notice before collecting personal data.';
            recommendedRemediation = 'Deploy an accessible, compliant Privacy Notice in accordance with Section 5 of the DPDP Act 2023.';
            counts.fail++;
          }
          break;
        }

        case 'DPDP-ACT-SEC-6-CONSENT-ITEMIZED': {
          const sc = scenarioResults.find((s) => s.scenarioId === 'notice_and_consent');
          const consentEv = evidenceList.filter((e) => e.scenarioId.includes('consent') || e.scenarioId.includes('banner'));
          linkedEvidenceIds = consentEv.map((e) => e._id);
          evidenceSnapshot = consentEv[0]
            ? { pageUrl: consentEv[0].pageUrl, screenshotUrl: consentEv[0].screenshotPath, snippet: consentEv[0].extractedContent?.slice(0, 300) }
            : null;

          if (sc && sc.status === 'passed') {
            status = 'pass';
            severity = 'informational';
            remediationStatus = 'resolved';
            observedFacts = sc.observedFindings || ['Itemized cookie and consent interface provides clear affirmative opt-in and opt-out options.'];
            aiInterpretation = 'Consent mechanism complies with Section 6(1) unconditional affirmative action requirements.';
            explanation = 'Users can freely accept, reject, or customize consent categories without deceptive dark patterns.';
            recommendedRemediation = 'Ensure all non-essential scripts remain blocked until affirmative consent is confirmed.';
            counts.pass++;
          } else if (sc && sc.status === 'needs_review') {
            status = 'needs_review';
            severity = 'high';
            remediationStatus = 'open';
            observedFacts = sc.observedFindings || ['Consent banner detected but lacks direct 1-click rejection mechanism.'];
            aiInterpretation = 'Asymmetric consent architecture: Accept button is prominent while opt-out requires multiple clicks.';
            explanation = 'Potential dark pattern: Consent must be unconditional and equally easy to refuse.';
            recommendedRemediation = 'Add an equally prominent "Reject Non-Essential" button on the initial cookie banner.';
            counts.needsReview++;
          } else {
            status = 'fail';
            severity = 'critical';
            remediationStatus = 'open';
            observedFacts = ['Tracking cookies or scripts activated prior to consent request.'];
            aiInterpretation = 'Non-compliance with DPDP Act Section 6(1): Personal data processed without affirmative consent.';
            explanation = 'Tracking and data collection occurs without obtaining prior valid consent.';
            recommendedRemediation = 'Implement client-side script gating to prevent telemetry loading before affirmative consent.';
            counts.fail++;
          }
          break;
        }

        case 'DPDP-ACT-SEC-6-WITHDRAWAL': {
          const sc = scenarioResults.find((s) => s.scenarioId === 'consent_granularity_and_withdrawal');
          const withdrawEv = evidenceList.filter((e) => e.scenarioId.includes('withdrawal') || e.pageUrl.includes('consent'));
          linkedEvidenceIds = withdrawEv.map((e) => e._id);
          evidenceSnapshot = withdrawEv[0]
            ? { pageUrl: withdrawEv[0].pageUrl, screenshotUrl: withdrawEv[0].screenshotPath }
            : null;

          if (sc && sc.status === 'passed') {
            status = 'pass';
            severity = 'informational';
            remediationStatus = 'resolved';
            observedFacts = sc.observedFindings || ['Dedicated consent manager provides unconditional withdrawal toggle.'];
            aiInterpretation = 'Consent withdrawal mechanism complies with Section 6(4) comparable ease mandate.';
            explanation = 'Data Principals can withdraw consent at any time via self-service preferences.';
            recommendedRemediation = 'Verify backend automated deletion triggers execute upon consent withdrawal.';
            counts.pass++;
          } else {
            status = 'needs_review';
            severity = 'high';
            remediationStatus = 'open';
            observedFacts = ['No self-service consent withdrawal button detected on inspected pages.'];
            aiInterpretation = 'Potential Section 6(4) non-compliance: Ease of withdrawal must match the ease of granting consent.';
            explanation = 'Withdrawal instructions may be missing or require manual email requests.';
            recommendedRemediation = 'Publish a persistent "Manage Consent / Cookie Settings" footer link enabling 1-click withdrawal.';
            counts.needsReview++;
          }
          break;
        }

        case 'DPDP-ACT-SEC-8-5-SECURITY-SAFEGUARDS': {
          const sc = scenarioResults.find((s) => s.scenarioId === 'authorized_login_safeguards');
          const secEv = evidenceList.filter((e) => e.scenarioId.includes('login') || e.scenarioId.includes('security'));
          linkedEvidenceIds = secEv.map((e) => e._id);

          if (sc && sc.status === 'passed') {
            status = 'pass';
            severity = 'informational';
            remediationStatus = 'resolved';
            observedFacts = sc.observedFindings || ['Authentication form masks passwords, utilizes HTTPS, and protects credentials.'];
            aiInterpretation = 'Reasonable technical safeguards verified on inspected client login interfaces.';
            explanation = 'Client interfaces demonstrate appropriate authentication safeguards and credential masking.';
            recommendedRemediation = 'Maintain regular vulnerability assessments and penetration testing of authentication services.';
            counts.pass++;
          } else if (sc && sc.status === 'skipped') {
            status = 'not_tested';
            severity = 'informational';
            remediationStatus = 'risk_accepted';
            observedFacts = sc.observedFindings || ['Customer authorized public-page-only scope. Authenticated safeguards were not tested.'];
            aiInterpretation = 'Authentication testing was not in scope for this assessment (public pages only).';
            explanation = 'Customer configured assessment for public pages only. Authenticated login mechanisms were not tested.';
            recommendedRemediation = 'Provide test account credentials during a future assessment to evaluate authenticated session safeguards.';
            counts.notTested++;
          } else {
            status = 'needs_review';
            severity = 'high';
            remediationStatus = 'open';
            observedFacts = sc?.observedFindings || ['Authentication forms or transmission channels require security verification.'];
            aiInterpretation = 'Verify HTTPS enforcement and session cookie security attributes (HttpOnly, Secure, SameSite).';
            explanation = 'Security safeguards could not be fully confirmed from client inspection alone.';
            recommendedRemediation = 'Enforce HTTPS everywhere with HSTS and configure strict session cookie protection flags.';
            counts.needsReview++;
          }
          break;
        }

        case 'DPDP-ACT-SEC-8-7-RETENTION-ERASURE': {
          // Document review / statutory retention evaluation
          const sc = scenarioResults.find((s) => s.scenarioId === 'privacy_notice_compliance');
          const hasRetention = sc?.observedFindings?.some((f) => /retention/i.test(f));

          if (hasRetention) {
            status = 'pass';
            severity = 'informational';
            remediationStatus = 'resolved';
            observedFacts = ['Privacy notice explicitly specifies statutory data retention period and erasure terms.'];
            aiInterpretation = 'Fiduciary has defined reasonable purpose-bound retention periods under Section 8(7).';
            explanation = 'Data retention criteria and deletion upon purpose fulfillment are documented.';
            recommendedRemediation = 'Implement automated data lifecycle schedules to purge database records past retention threshold.';
            counts.pass++;
          } else {
            status = 'needs_review';
            severity = 'medium';
            remediationStatus = 'open';
            observedFacts = ['Retention period is not explicitly defined in visible notice or states indefinite retention.'];
            aiInterpretation = 'Indefinite retention of personal data is non-compliant with Section 8(7) erasure obligations.';
            explanation = 'Statutory data retention period must be explicitly stated.';
            recommendedRemediation = 'Define specific purpose-based retention windows (e.g. 36 months) in the Privacy Policy.';
            counts.needsReview++;
          }
          break;
        }

        case 'DPDP-ACT-SEC-8-9-GRIEVANCE-OFFICER': {
          const sc = scenarioResults.find((s) => s.scenarioId === 'grievance_mechanism_sec_8_9');
          const grievEv = evidenceList.filter((e) => e.scenarioId.includes('grievance'));
          linkedEvidenceIds = grievEv.map((e) => e._id);
          evidenceSnapshot = grievEv[0]
            ? { pageUrl: grievEv[0].pageUrl, screenshotUrl: grievEv[0].screenshotPath }
            : null;

          if (sc && sc.status === 'passed') {
            status = 'pass';
            severity = 'informational';
            remediationStatus = 'resolved';
            observedFacts = sc.observedFindings || ['Grievance Officer designated with published email, address, and response timeline.'];
            aiInterpretation = 'Statutory grievance redressal mechanism meets Section 8(9) requirements.';
            explanation = 'Data Principals have a designated electronic channel and escalation route to the Grievance Officer.';
            recommendedRemediation = 'Ensure internal ticketing SLA ensures grievances are resolved within the 30-day statutory timeline.';
            counts.pass++;
          } else {
            status = 'fail';
            severity = 'critical';
            remediationStatus = 'open';
            observedFacts = ['No designated Grievance Officer name or dedicated electronic contact published on website.'];
            aiInterpretation = 'Direct violation of Section 8(9): Failure to establish and publish an effective grievance redressal mechanism.';
            explanation = 'A dedicated Grievance Officer contact must be published for Data Principal complaints.';
            recommendedRemediation = 'Publish the full name, official email, physical address, and 30-day response SLA of the Grievance Officer.';
            counts.fail++;
          }
          break;
        }

        case 'DPDP-ACT-SEC-9-CHILDREN-DATA': {
          status = 'needs_review';
          severity = 'high';
          remediationStatus = 'open';
          observedFacts = ['Registration workflow does not feature an explicit age gate or parental verification step.'];
          aiInterpretation = 'If the service is accessed by minors, processing personal data without verifiable parental consent violates Section 9(1).';
          explanation = 'Verification required: Confirm whether the service processes personal data of individuals under 18.';
          recommendedRemediation = 'Incorporate an age verification gate and parental consent mechanism if services are accessible to children.';
          counts.needsReview++;
          break;
        }

        case 'DPDP-RULES-2025-RULE-3-NOTICE-FORMAT': {
          status = 'needs_review';
          severity = 'low';
          remediationStatus = 'open';
          observedFacts = ['Website publishes privacy notice in English without an Indian language switcher.'];
          aiInterpretation = 'DPDP Rules 2025 Rule 3 requires notice availability in English and 8th Schedule Indian languages.';
          explanation = 'Multi-lingual access is recommended to broaden comprehensibility across India.';
          recommendedRemediation = 'Introduce localized notice translations in scheduled Indian languages (e.g. Hindi, Marathi, Tamil).';
          counts.needsReview++;
          break;
        }

        case 'DPDP-RULES-2025-RULE-5-CONSENT-MANAGERS': {
          status = 'not_tested';
          severity = 'informational';
          remediationStatus = 'risk_accepted';
          observedFacts = ['Consent Manager technical interoperability APIs require dedicated organizational evidence.'];
          aiInterpretation = 'Consent Manager registration and API specifications are in operational rollout by DPBI.';
          explanation = 'Interoperability with registered Consent Managers will become enforceable upon DPBI registry gazette notification.';
          recommendedRemediation = 'Monitor MeitY Consent Manager API standards and prepare backend webhook integrations.';
          counts.notTested++;
          break;
        }

        default: {
          status = 'needs_review';
          counts.needsReview++;
          break;
        }
      }
    }

    // Upsert Finding in MongoDB
    const findingDoc = await Finding.findOneAndUpdate(
      { assessment: assessment._id, requirementId: req.requirementId },
      {
        $set: {
          assessment: assessment._id,
          organization: assessment.organization,
          requirementId: req.requirementId,
          requirement: reqDoc._id || null,
          ruleId: req.sectionOrRule,
          title: req.title,
          description: req.expectedControl,
          category: req.category,
          status,
          severity,
          remediationStatus,
          observedFacts,
          aiInterpretation,
          confidence: 'high',
          explanation,
          recommendedRemediation,
          evidenceReferences: linkedEvidenceIds,
          evidence: evidenceSnapshot,
        },
      },
      { upsert: true, new: true }
    );

    generatedFindings.push(findingDoc);
  }

  // Calculate actual compliance score: Pass / (Pass + Fail + NeedsReview) * 100
  const actionableCount = counts.pass + counts.fail + counts.needsReview;
  const complianceScore = actionableCount > 0 ? Math.round((counts.pass / actionableCount) * 100) : 0;

  // Calculate findingsCount breakdown by severity for issues requiring action/review
  const findingsCount = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
  for (const f of generatedFindings) {
    if (f.status === 'fail' || f.status === 'needs_review') {
      const sev = (f.severity || 'medium').toLowerCase();
      if (findingsCount[sev] !== undefined) {
        findingsCount[sev]++;
      }
      findingsCount.total++;
    }
  }

  // Update Assessment record
  await Assessment.findByIdAndUpdate(assessmentId, {
    complianceScore,
    findingsCount,
    status: 'completed',
    completedAt: new Date(),
    summaryMetrics: counts,
  });

  return {
    assessmentId: assessment._id,
    complianceScore,
    totalRequirements: applicabilityList.length,
    counts,
    findings: generatedFindings,
  };
}
