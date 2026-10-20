import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Assessment from '@/models/Assessment';
import ScenarioResult from '@/models/ScenarioResult';
import Finding from '@/models/Finding';
import { requireAuth, ROLES } from '@/lib/auth';
import { getWebsiteDisplayName } from '@/lib/assessment-summary';

export const dynamic = 'force-dynamic';

const STATUTORY_SCENARIOS = [
  { id: 'notice_and_consent', title: 'Consent Notice & Cookie Banner', category: 'notice_and_consent', dpdpReference: 'Sec 5 & 6' },
  { id: 'privacy_notice_compliance', title: 'Privacy Notice Disclosures', category: 'notice_and_consent', dpdpReference: 'Sec 5' },
  { id: 'grievance_mechanism_sec_8_9', title: 'Grievance Redressal & DPO', category: 'grievance_redressal', dpdpReference: 'Sec 8(9)' },
  { id: 'data_minimization_and_notice', title: 'Data Minimization on Forms', category: 'data_minimization', dpdpReference: 'Sec 6(1)' },
  { id: 'consent_granularity_and_withdrawal', title: 'Consent Granularity & Withdrawal', category: 'user_rights', dpdpReference: 'Sec 6(4)' },
  { id: 'authorized_login_safeguards', title: 'Authentication Safeguards', category: 'security_safeguards', dpdpReference: 'Sec 8(5)' },
];

/**
 * GET /api/assessments/[id]/compare
 * Compares current assessment results with a previous baseline assessment run.
 */
export async function GET(request, { params }) {
  try {
    const { session, errorResponse } = requireAuth(request);
    if (errorResponse) return errorResponse;

    await connectDB();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const { searchParams } = new URL(request.url);
    const baselineId = searchParams.get('baselineId');

    const currentAssessment = await Assessment.findById(id).populate('organization', 'name industry').lean();
    if (!currentAssessment) {
      return NextResponse.json({ success: false, error: 'Current assessment not found.' }, { status: 404 });
    }

    const orgId = currentAssessment.organization?._id || currentAssessment.organization;

    // RBAC: Verify access
    const isPlatformAdmin = session.role === 'admin' || session.role === ROLES.PLATFORM_ADMINISTRATOR;
    if (!isPlatformAdmin && String(orgId) !== String(session.organizationId)) {
      return NextResponse.json({ success: false, error: 'Forbidden. Access denied.' }, { status: 403 });
    }

    // Find all runs for this website to provide comparison choices
    const allRuns = await Assessment.find({
      organization: orgId,
      targetUrl: currentAssessment.targetUrl,
    })
      .sort({ sequenceNumber: 1, createdAt: 1 })
      .select('_id sequenceNumber createdAt status complianceScore isReassessment scopeConfig')
      .lean();

    // Determine baseline assessment
    let baseline = null;
    if (baselineId) {
      baseline = await Assessment.findById(baselineId).populate('organization', 'name industry').lean();
    } else if (currentAssessment.previousAssessmentId) {
      baseline = await Assessment.findById(currentAssessment.previousAssessmentId).populate('organization', 'name industry').lean();
    } else {
      // Find the immediately preceding run by creation time
      baseline = await Assessment.findOne({
        _id: { $ne: currentAssessment._id },
        organization: orgId,
        targetUrl: currentAssessment.targetUrl,
        createdAt: { $lt: currentAssessment.createdAt },
      })
        .sort({ createdAt: -1 })
        .populate('organization', 'name industry')
        .lean();
    }

    if (!baseline) {
      return NextResponse.json({
        success: true,
        hasComparison: false,
        currentAssessment,
        allRuns,
        message: 'No previous assessment found to compare against. This is the first assessment for this website.',
      });
    }

    // Verify baseline belongs to same organization
    const baselineOrgId = baseline.organization?._id || baseline.organization;
    if (String(baselineOrgId) !== String(orgId)) {
      return NextResponse.json({ success: false, error: 'Cannot compare assessments across different organizations.' }, { status: 403 });
    }

    // Load persisted results for both runs
    const [currentScenarios, baselineScenarios, currentFindings, baselineFindings] = await Promise.all([
      ScenarioResult.find({ assessmentId: currentAssessment._id }).lean(),
      ScenarioResult.find({ assessmentId: baseline._id }).lean(),
      Finding.find({ assessment: currentAssessment._id }).lean(),
      Finding.find({ assessment: baseline._id }).lean(),
    ]);

    // 1. Scenario Side-by-Side Matrix
    const scenarioMatrix = STATUTORY_SCENARIOS.map((st) => {
      const cur = currentScenarios.find((s) => s.scenarioId === st.id);
      const prev = baselineScenarios.find((s) => s.scenarioId === st.id);

      const curStatus = cur ? cur.status : 'not_tested';
      const prevStatus = prev ? prev.status : 'not_tested';

      let changeType = 'unchanged';
      if (curStatus === 'passed' && (prevStatus === 'failed' || prevStatus === 'needs_review')) {
        changeType = 'improved';
      } else if ((curStatus === 'failed' || curStatus === 'needs_review') && prevStatus === 'passed') {
        changeType = 'regressed';
      } else if (curStatus !== prevStatus) {
        changeType = 'status_changed';
      }

      return {
        scenarioId: st.id,
        title: st.title,
        category: st.category,
        dpdpReference: st.dpdpReference,
        current: {
          status: curStatus,
          summary: cur?.summary || 'Not executed in this assessment run.',
          observedCount: cur?.observedFindings?.length || 0,
        },
        previous: {
          status: prevStatus,
          summary: prev?.summary || 'Not executed in previous assessment run.',
          observedCount: prev?.observedFindings?.length || 0,
        },
        changeType,
      };
    });

    // 2. Finding Differences (Matched by requirementId)
    const prevFindingMap = new Map();
    for (const f of baselineFindings) {
      if (f.requirementId) prevFindingMap.set(f.requirementId, f);
    }

    const curFindingMap = new Map();
    for (const f of currentFindings) {
      if (f.requirementId) curFindingMap.set(f.requirementId, f);
    }

    const resolvedFindings = [];
    const newFindings = [];
    const persistentFindings = [];
    const severityChanges = [];

    // Analyze previous findings
    for (const [reqId, prevFinding] of prevFindingMap.entries()) {
      const curFinding = curFindingMap.get(reqId);
      const wasFailing = prevFinding.status === 'fail' || prevFinding.status === 'needs_review';

      if (wasFailing) {
        if (!curFinding || curFinding.status === 'pass') {
          resolvedFindings.push({
            requirementId: reqId,
            ruleId: prevFinding.ruleId,
            title: prevFinding.title,
            category: prevFinding.category,
            previousStatus: prevFinding.status,
            currentStatus: curFinding ? curFinding.status : 'pass',
            previousSeverity: prevFinding.severity,
          });
        } else if (curFinding.status === 'fail' || curFinding.status === 'needs_review') {
          persistentFindings.push({
            requirementId: reqId,
            ruleId: curFinding.ruleId,
            title: curFinding.title,
            category: curFinding.category,
            currentStatus: curFinding.status,
            previousStatus: prevFinding.status,
            currentSeverity: curFinding.severity,
            previousSeverity: prevFinding.severity,
          });

          if (curFinding.severity !== prevFinding.severity) {
            severityChanges.push({
              requirementId: reqId,
              title: curFinding.title,
              previousSeverity: prevFinding.severity,
              currentSeverity: curFinding.severity,
            });
          }
        }
      }
    }

    // Analyze current findings for newly discovered issues
    for (const [reqId, curFinding] of curFindingMap.entries()) {
      const prevFinding = prevFindingMap.get(reqId);
      const isFailing = curFinding.status === 'fail' || curFinding.status === 'needs_review';

      if (isFailing) {
        const wasPreviouslyClean = !prevFinding || prevFinding.status === 'pass' || prevFinding.status === 'not_tested';
        if (wasPreviouslyClean) {
          newFindings.push({
            requirementId: reqId,
            ruleId: curFinding.ruleId,
            title: curFinding.title,
            category: curFinding.category,
            currentStatus: curFinding.status,
            previousStatus: prevFinding ? prevFinding.status : 'not_tested',
            severity: curFinding.severity,
          });
        }
      }
    }

    // 3. Testing Scope Differences
    const curScope = currentAssessment.scopeConfig || {};
    const prevScope = baseline.scopeConfig || {};
    const curAuth = curScope.hasAuthTesting || false;
    const prevAuth = prevScope.hasAuthTesting || false;

    const isIdenticalScope = curAuth === prevAuth;
    let scopeDifferenceExplanation = 'Both runs evaluated the same scope.';
    if (!isIdenticalScope) {
      if (curAuth && !prevAuth) {
        scopeDifferenceExplanation = `Run #${currentAssessment.sequenceNumber || 2} included authenticated testing (${curScope.testLoginUrl || 'login flow'}), whereas Run #${baseline.sequenceNumber || 1} was restricted to public pages only.`;
      } else {
        scopeDifferenceExplanation = `Run #${currentAssessment.sequenceNumber || 2} evaluated public pages only, whereas Run #${baseline.sequenceNumber || 1} included authenticated testing.`;
      }
    }

    // 4. Compliance Score Delta
    const curScore = currentAssessment.complianceScore !== null && currentAssessment.complianceScore !== undefined
      ? currentAssessment.complianceScore
      : null;
    const prevScore = baseline.complianceScore !== null && baseline.complianceScore !== undefined
      ? baseline.complianceScore
      : null;
    const scoreDelta = (curScore !== null && prevScore !== null) ? (curScore - prevScore) : null;

    return NextResponse.json({
      success: true,
      hasComparison: true,
      currentAssessment: {
        _id: currentAssessment._id,
        sequenceNumber: currentAssessment.sequenceNumber || 1,
        targetUrl: currentAssessment.targetUrl,
        websiteName: getWebsiteDisplayName(currentAssessment),
        createdAt: currentAssessment.createdAt,
        complianceScore: curScore,
        status: currentAssessment.status,
        findingsCount: currentAssessment.findingsCount,
        scopeConfig: curScope,
      },
      baselineAssessment: {
        _id: baseline._id,
        sequenceNumber: baseline.sequenceNumber || 1,
        targetUrl: baseline.targetUrl,
        websiteName: getWebsiteDisplayName(baseline),
        createdAt: baseline.createdAt,
        complianceScore: prevScore,
        status: baseline.status,
        findingsCount: baseline.findingsCount,
        scopeConfig: prevScope,
      },
      scoreDelta,
      allRuns,
      scopeComparison: {
        isIdenticalScope,
        explanation: scopeDifferenceExplanation,
      },
      scenarioMatrix,
      findingsDiff: {
        resolved: resolvedFindings,
        new: newFindings,
        persistent: persistentFindings,
        severityChanges,
        resolvedCount: resolvedFindings.length,
        newCount: newFindings.length,
        persistentCount: persistentFindings.length,
      },
    });
  } catch (err) {
    console.error('Error in assessment comparison:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
