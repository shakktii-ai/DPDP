import mongoose from 'mongoose';
import connectDB from './mongodb.js';
import Assessment from '../models/Assessment.js';
import Finding from '../models/Finding.js';
import ScenarioResult from '../models/ScenarioResult.js';
import Evidence from '../models/Evidence.js';

/**
 * Standardized score methodology text and documentation
 */
export const SCORE_METHODOLOGY = {
  formula: 'Compliant ÷ (Compliant + Action Needed + Needs Review) × 100',
  description:
    'Compliance score is calculated exclusively from applicable statutory requirements. Not Applicable and Not Tested checkpoints are excluded from the denominator. Needs Review checkpoints are not counted as compliant.',
};

/**
 * Derives a clean display name for a website from target URL or database record.
 */
export function getWebsiteDisplayName(asm) {
  if (asm.websiteName && asm.websiteName.trim() && !asm.websiteName.startsWith('http')) {
    return asm.websiteName.trim();
  }
  if (asm.organization?.name && asm.organization.name !== 'Unassigned Organization') {
    return asm.organization.name;
  }
  if (asm.targetUrl) {
    try {
      const url = new URL(asm.targetUrl);
      return url.hostname;
    } catch {
      return asm.targetUrl;
    }
  }
  return 'Target Website';
}

/**
 * Pure function to compute a standardized summary payload from assessment and findings.
 * 
 * @param {object} asm - Assessment document or lean object
 * @param {Array} findings - Array of Finding documents or lean objects
 * @param {Array} [scenarioResults] - Optional array of ScenarioResult documents
 * @param {number} [evidenceCount] - Optional total evidence count
 * @param {number} [siblingRunsCount] - Count of total runs for this target
 * @returns {object} Standardized assessment summary
 */
export function computeAssessmentSummary({
  assessment: asm,
  findings = [],
  scenarioResults = [],
  evidenceCount = 0,
  siblingRunsCount = 1,
}) {
  const counts = {
    pass: 0,
    fail: 0,
    needs_review: 0,
    not_applicable: 0,
    not_tested: 0,
  };

  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0,
  };

  for (const f of findings) {
    const status = f.status;
    if (counts[status] !== undefined) {
      counts[status]++;
    }
    const severity = f.severity;
    if (severityCounts[severity] !== undefined) {
      severityCounts[severity]++;
    }
  }

  // Denominator: Only applicable, evaluated requirements
  const actionableCount = counts.pass + counts.fail + counts.needs_review;

  // Determine whether compliance score can be reliably calculated
  const isCompleted = asm.status === 'completed';
  const hasEvaluatedData = actionableCount > 0 || counts.pass > 0;

  let complianceScore = null;
  let scoreDisplay = 'Not calculated';
  let scoreStatus = 'incomplete';

  if (!isCompleted) {
    if (asm.status === 'in_progress') {
      scoreDisplay = 'Evaluating...';
      scoreStatus = 'in_progress';
    } else if (asm.status === 'failed') {
      scoreDisplay = 'Not calculated (Failed)';
      scoreStatus = 'failed';
    } else {
      scoreDisplay = 'Not calculated';
      scoreStatus = 'queued';
    }
  } else if (!hasEvaluatedData && findings.length === 0) {
    scoreDisplay = 'Not calculated';
    scoreStatus = 'no_findings';
  } else if (actionableCount === 0) {
    scoreDisplay = 'Not applicable';
    scoreStatus = 'not_applicable';
  } else {
    complianceScore = Math.round((counts.pass / actionableCount) * 100);
    scoreDisplay = `${complianceScore}%`;
    scoreStatus = 'calculated';
  }

  const websiteName = getWebsiteDisplayName(asm);
  const targetUrl = asm.targetUrl || '';

  return {
    _id: String(asm._id),
    assessmentId: String(asm._id),
    targetUrl,
    websiteName,
    organizationName: asm.organization?.name || 'Unassigned Organization',
    organizationId: asm.organization?._id ? String(asm.organization._id) : (asm.organization ? String(asm.organization) : null),
    status: asm.status || 'queued',
    sequenceNumber: asm.sequenceNumber || 1,
    isReassessment: Boolean(asm.isReassessment),
    previousAssessmentId: asm.previousAssessmentId ? String(asm.previousAssessmentId) : null,
    rootAssessmentId: asm.rootAssessmentId ? String(asm.rootAssessmentId) : null,
    hasComparableRuns: siblingRunsCount > 1,
    createdAt: asm.createdAt,
    completedAt: asm.completedAt || null,
    totalScenariosEvaluated: scenarioResults.length,
    evidenceCount: evidenceCount || 0,
    totalFindings: findings.length,
    counts,
    severityCounts,
    actionableCount,
    complianceScore,
    scoreDisplay,
    scoreStatus,
    scoreMethodology: SCORE_METHODOLOGY,
    hasReport: isCompleted && findings.length > 0,
    failureReason: asm.failureReason || null,
    scopeConfig: asm.scopeConfig || {},
  };
}

/**
 * Loads and returns a standardized summary for a single assessment ID or document.
 */
export async function getAssessmentSummary(assessmentIdOrDoc) {
  await connectDB();

  if (!assessmentIdOrDoc) return null;

  let asm = assessmentIdOrDoc;
  if (
    typeof assessmentIdOrDoc === 'string' ||
    mongoose.isValidObjectId(assessmentIdOrDoc) ||
    !assessmentIdOrDoc.targetUrl
  ) {
    asm = await Assessment.findById(assessmentIdOrDoc).populate('organization', 'name industry').lean();
  } else if (asm && typeof asm.toObject === 'function') {
    asm = asm.toObject();
  }

  if (!asm) return null;

  const [findings, scenarioResults, evidenceCount, siblingRunsCount] = await Promise.all([
    Finding.find({ assessment: asm._id }).lean(),
    ScenarioResult.find({ assessmentId: asm._id }).lean(),
    Evidence.countDocuments({ assessmentId: asm._id }),
    Assessment.countDocuments({
      organization: asm.organization?._id || asm.organization,
      targetUrl: asm.targetUrl,
    }),
  ]);

  return computeAssessmentSummary({
    assessment: asm,
    findings,
    scenarioResults,
    evidenceCount,
    siblingRunsCount,
  });
}

/**
 * Batch loads and returns standardized summaries for a list of assessments or query.
 */
export async function getAssessmentSummaries(queryOrAssessments = {}) {
  await connectDB();

  let assessments = [];
  if (Array.isArray(queryOrAssessments)) {
    assessments = queryOrAssessments;
  } else {
    assessments = await Assessment.find(queryOrAssessments)
      .populate('organization', 'name industry')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  }

  if (assessments.length === 0) return [];

  const assessmentIds = assessments.map((a) => a._id);

  // Batch query all findings, scenario results, and evidence
  const [allFindings, allScenarios, allEvidence] = await Promise.all([
    Finding.find({ assessment: { $in: assessmentIds } }).lean(),
    ScenarioResult.find({ assessmentId: { $in: assessmentIds } }).lean(),
    Evidence.find({ assessmentId: { $in: assessmentIds } }, { assessmentId: 1 }).lean(),
  ]);

  // Group by assessment ID
  const findingsByAsm = new Map();
  for (const f of allFindings) {
    const key = String(f.assessment);
    if (!findingsByAsm.has(key)) findingsByAsm.set(key, []);
    findingsByAsm.get(key).push(f);
  }

  const scenariosByAsm = new Map();
  for (const s of allScenarios) {
    const key = String(s.assessmentId);
    if (!scenariosByAsm.has(key)) scenariosByAsm.set(key, []);
    scenariosByAsm.get(key).push(s);
  }

  const evidenceCountByAsm = new Map();
  for (const e of allEvidence) {
    const key = String(e.assessmentId);
    evidenceCountByAsm.set(key, (evidenceCountByAsm.get(key) || 0) + 1);
  }

  // Count runs per target url
  const targetCounts = new Map();
  for (const a of assessments) {
    const orgKey = String(a.organization?._id || a.organization);
    const key = `${orgKey}:::${a.targetUrl}`;
    targetCounts.set(key, (targetCounts.get(key) || 0) + 1);
  }

  return assessments.map((asm) => {
    const asmId = String(asm._id);
    const orgKey = String(asm.organization?._id || asm.organization);
    const siblingRunsCount = targetCounts.get(`${orgKey}:::${asm.targetUrl}`) || 1;

    return computeAssessmentSummary({
      assessment: asm,
      findings: findingsByAsm.get(asmId) || [],
      scenarioResults: scenariosByAsm.get(asmId) || [],
      evidenceCount: evidenceCountByAsm.get(asmId) || 0,
      siblingRunsCount,
    });
  });
}
