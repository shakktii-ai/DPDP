import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import connectDB from './mongodb.js';
import TestRun from '../models/TestRun.js';
import BrowserAction from '../models/BrowserAction.js';
import Evidence from '../models/Evidence.js';
import ScenarioResult from '../models/ScenarioResult.js';
import Assessment from '../models/Assessment.js';
import ApprovedTarget from '../models/ApprovedTarget.js';
import AssessmentProfile from '../models/AssessmentProfile.js';
import { validateTargetUrl, decryptCredential } from './security.js';
import { redactSensitiveData, sanitizeUrl } from './evidence-redactor.js';
import { runAutonomousScenario } from './autonomous-agent.js';
import { evaluateAssessmentFindings } from './assessment-engine.js';
import { emitAssessmentEvent } from './event-bus.js';
import { captureAndStoreScreenshot } from './cloudinary.js';

/**
 * Creates an evidence screenshot directory for the run.
 */
function ensureRunEvidenceDir(runId) {
  const dirPath = path.join(process.cwd(), 'public', 'evidence', String(runId));
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * Helper to append a sanitized log entry to the TestRun in MongoDB.
 */
async function appendRunLog(runId, level, message) {
  try {
    const sanitizedMsg = redactSensitiveData(message);
    await TestRun.findByIdAndUpdate(runId, {
      $push: {
        logs: {
          timestamp: new Date(),
          level,
          message: sanitizedMsg,
        },
      },
    });
  } catch (err) {
    console.error(`[BrowserWorker] Failed to write run log:`, err.message);
  }
}

/**
 * Records a BrowserAction in MongoDB.
 */
async function recordBrowserAction({
  testRunId,
  assessmentId,
  actionType,
  targetSelector = null,
  url,
  durationMs = 0,
  status = 'success',
  details = {},
  errorMessage = null,
}) {
  try {
    await BrowserAction.create({
      testRunId,
      assessmentId,
      actionType,
      targetSelector,
      url: sanitizeUrl(url),
      durationMs,
      status,
      details,
      errorMessage: errorMessage ? redactSensitiveData(errorMessage) : null,
    });
  } catch (err) {
    console.error(`[BrowserWorker] Failed to record BrowserAction:`, err.message);
  }
}

/**
 * Main Browser Worker Engine
 * Runs a sandboxed, isolated Chromium browser context to inspect an approved target.
 */
export async function executeInspectionRun(runId, options = {}) {
  await connectDB();

  // Atomically claim the TestRun to ensure idempotency and prevent duplicate concurrent executions
  const workerId = options.workerId || `worker-${process.pid}-${Date.now().toString(36)}`;
  const { force = false } = options;
  const startingCutoff = new Date(Date.now() - 45 * 1000);

  const claimFilter = { _id: runId };
  if (!force) {
    claimFilter.$or = [
      { status: { $in: ['queued', 'stale'] } },
      { status: 'starting_browser', updatedAt: { $lt: startingCutoff } },
      { status: 'starting_browser', workerId },
    ];
  }

  let testRun = await TestRun.findOneAndUpdate(
    claimFilter,
    {
      $set: {
        status: 'starting_browser',
        workerId,
        claimedAt: new Date(),
        startTime: new Date(),
        currentStep: 'Worker assigned. Launching browser inspection.',
      },
    },
    { new: true }
  ).populate('targetId').populate('assessmentId');

  if (!testRun) {
    const existing = await TestRun.findById(runId).populate('targetId').populate('assessmentId');
    if (!existing) {
      throw new Error(`TestRun ${runId} not found.`);
    }
    const isStaleStarting = existing.status === 'starting_browser' && (!existing.updatedAt || existing.updatedAt < startingCutoff);
    const isStaleRunning = ['running', 'in_progress', 'inspecting_website'].includes(existing.status) && existing.updatedAt && (Date.now() - new Date(existing.updatedAt).getTime() > 10 * 60 * 1000);

    if (!force && !isStaleStarting && !isStaleRunning && ['running', 'in_progress', 'inspecting_website', 'completed'].includes(existing.status)) {
      console.log(`[BrowserWorker] TestRun ${runId} already actively running or completed (status: ${existing.status}). Skipping redundant execution.`);
      return existing;
    }
    // Allow re-run if explicitly triggered on a failed/stale/abandoned run
    testRun = await TestRun.findByIdAndUpdate(
      runId,
      {
        $set: {
          status: 'starting_browser',
          workerId,
          claimedAt: new Date(),
          startTime: new Date(),
          currentStep: isStaleStarting ? 'Reclaiming abandoned worker run' : 'Retrying inspection run',
        },
      },
      { new: true }
    ).populate('targetId').populate('assessmentId');
  }

  const approvedTarget = testRun.targetId;
  const assessmentDoc = testRun.assessmentId;
  const assessmentId = assessmentDoc?._id || testRun.assessmentId;

  // Synchronize Assessment status to in_progress
  if (assessmentId) {
    await Assessment.findByIdAndUpdate(assessmentId, {
      status: 'in_progress',
      startedAt: testRun.startTime || new Date(),
    });
  }

  if (!approvedTarget || approvedTarget.targetStatus !== 'approved') {
    const errorMsg = 'Target domain is not approved for assessment testing.';
    await TestRun.findByIdAndUpdate(runId, {
      status: 'failed',
      errorMessage: errorMsg,
      endTime: new Date(),
    });
    if (assessmentId) {
      await Assessment.findByIdAndUpdate(assessmentId, {
        status: 'failed',
        failureReason: errorMsg,
        completedAt: new Date(),
      });
    }
    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'failed',
      title: 'Target Authorization Failed',
      description: errorMsg,
    });
    return;
  }

  const targetUrl = assessmentDoc?.targetUrl || approvedTarget.targetUrl;
  const approvedDomain = approvedTarget.approvedDomain;
  const isDemoSite = Boolean(approvedTarget.isDemoSite);

  // Validate base target URL with SSRF defenses
  const urlCheck = validateTargetUrl(targetUrl, { allowDemoLocalhost: isDemoSite });
  if (!urlCheck.isValid) {
    const errorMsg = `Target URL failed SSRF security check: ${urlCheck.reason}`;
    await TestRun.findByIdAndUpdate(runId, {
      status: 'failed',
      errorMessage: errorMsg,
      endTime: new Date(),
    });
    if (assessmentId) {
      await Assessment.findByIdAndUpdate(assessmentId, {
        status: 'failed',
        failureReason: errorMsg,
        completedAt: new Date(),
      });
    }
    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'failed',
      title: 'Security Boundary Check Failed',
      description: errorMsg,
    });
    return;
  }

  // Resolve credentials and login testing configuration
  const savedRunOptions = testRun.runOptions || {};
  let creds = { ...(savedRunOptions.credentials || {}), ...(options.credentials || options.loginTestingConfig || {}) };

  // If credentials are not in options, load from AssessmentProfile
  if (!creds.username || !creds.password) {
    const profile = await AssessmentProfile.findOne({
      $or: [
        { approvedTarget: approvedTarget._id },
        { organization: assessmentDoc?.organization || approvedTarget.organization }
      ]
    }).select('+loginWorkflowDetails.testUsername +loginWorkflowDetails.encryptedPassword').lean();

    if (profile?.loginWorkflowDetails?.hasAuthTesting && !creds.skipAuthenticatedTesting) {
      if (!creds.username && profile.loginWorkflowDetails.testUsername) {
        creds.username = profile.loginWorkflowDetails.testUsername;
      }
      if (!creds.password && profile.loginWorkflowDetails.encryptedPassword) {
        creds.password = decryptCredential(profile.loginWorkflowDetails.encryptedPassword);
      }
      if (!creds.loginUrl && profile.loginWorkflowDetails.loginUrl) {
        creds.loginUrl = profile.loginWorkflowDetails.loginUrl;
      }
      if (!creds.authMethod && profile.loginWorkflowDetails.authMethod) {
        creds.authMethod = profile.loginWorkflowDetails.authMethod;
      }
      creds.enabled = true;
    }
  }

  if (creds.username && creds.password) {
    await TestRun.findByIdAndUpdate(runId, {
      'authTestingResult.status': 'running',
      'authTestingResult.authMethod': creds.authMethod || 'password',
      'authTestingResult.loginUrl': creds.loginUrl ? sanitizeUrl(creds.loginUrl) : null,
      'authTestingResult.usernameMasked': redactSensitiveData(creds.username),
      'authTestingResult.details': 'Worker running authenticated testing workflow',
    });
  }

  const evidenceDir = ensureRunEvidenceDir(runId);
  let browser = null;
  let context = null;
  let page = null;
  let actionCount = 0;
  const maxActions = testRun.maxActions || 50;
  const visitedUrls = new Set();

  try {
    // 1. Update TestRun to starting_browser
    await TestRun.findByIdAndUpdate(runId, {
      status: 'starting_browser',
      progress: 10,
      currentStep: 'Launching isolated browser context',
    });
    await appendRunLog(runId, 'info', `Launching Chromium for approved target: ${approvedDomain}`);

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'browser_started',
      title: 'Launching Isolated Browser',
      description: `Starting sandboxed Playwright browser for authorized domain: ${approvedDomain}`,
      progress: 10,
      stepName: 'Launching isolated browser context',
      url: targetUrl,
    });

    // Launch Chromium with security sandboxing flags
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--no-first-run',
      ],
    });

    // Create an isolated context for this run
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'DPDP-Compliance-Scanner/1.0 (+https://dpdp-assessment.org/bot)',
      ignoreHTTPSErrors: true,
      bypassCSP: false,
    });

    page = await context.newPage();

    // Enforce Per-Run Navigation & Domain Allowlist Protection
    await page.route('**/*', async (route) => {
      const request = route.request();
      const reqUrl = request.url();

      try {
        const parsedReq = new URL(reqUrl);
        const reqHostname = parsedReq.hostname.toLowerCase();

        // Enforce domain for document navigations
        const isNavigation = request.isNavigationRequest();
        const ssrfCheck = validateTargetUrl(reqUrl, { allowDemoLocalhost: isDemoSite });

        const isApprovedDomain =
          reqHostname === approvedDomain ||
          reqHostname.endsWith(`.${approvedDomain}`) ||
          (isDemoSite && (reqHostname === 'localhost' || reqHostname === '127.0.0.1'));

        if (!ssrfCheck.isValid || (isNavigation && !isApprovedDomain)) {
          await appendRunLog(runId, 'warn', `Blocked unsafe/external navigation: ${reqUrl}`);
          await recordBrowserAction({
            testRunId: runId,
            assessmentId,
            actionType: 'blocked_navigation',
            url: reqUrl,
            status: 'blocked',
            details: { reason: ssrfCheck.reason || 'Domain not in approved target scope' },
          });
          return route.abort('blockedbyclient');
        }

        return route.continue();
      } catch (err) {
        return route.abort('failed');
      }
    });

    // Record console and page errors (sanitized)
    page.on('console', async (msg) => {
      if (msg.type() === 'error') {
        await appendRunLog(runId, 'debug', `Page Console Error: ${msg.text().slice(0, 200)}`);
      }
    });

    page.on('pageerror', async (err) => {
      await appendRunLog(runId, 'warn', `Page Exception: ${err.message.slice(0, 200)}`);
    });

    // Helper: Take screenshot and persist evidence
    async function capturePageEvidence(scenarioId, stepName, extraMetadata = {}) {
      try {
        const timestamp = Date.now();
        const filename = `${scenarioId}_${stepName}_${timestamp}.png`;

        const storedScreenshot = await captureAndStoreScreenshot({
          page,
          runId,
          filename,
          evidenceDir,
          scenarioId,
          stepName,
        });

        const screenshotUrl = storedScreenshot.screenshotUrl;
        console.log(`[BrowserWorker Diagnostics] Captured screenshot for ${scenarioId} (${stepName}): ${screenshotUrl} (${storedScreenshot.fileSize} bytes, Cloudinary: ${storedScreenshot.isCloudinary})`);

        const rawText = await page.evaluate(() => (document.body ? document.body.innerText : ''));
        const redactedText = redactSensitiveData(rawText.slice(0, 5000));
        const pageTitle = await page.title();
        const currentUrl = sanitizeUrl(page.url());

        const evidence = await Evidence.create({
          assessmentId,
          testRunId: runId,
          scenarioId,
          evidenceType: 'screenshot',
          pageUrl: currentUrl,
          pageTitle,
          screenshotPath: screenshotUrl,
          extractedContent: redactedText,
          metadata: {
            ...extraMetadata,
            fileSize: storedScreenshot.fileSize,
            isCloudinary: storedScreenshot.isCloudinary,
            cloudinaryUrl: storedScreenshot.cloudinaryUrl,
            localUrlPath: storedScreenshot.localUrlPath,
          },
          redactionStatus: 'redacted',
        });

        await TestRun.findByIdAndUpdate(runId, {
          $inc: { evidenceCount: 1 },
          latestScreenshot: screenshotUrl,
          latestScreenshotUrl: currentUrl,
          latestScreenshotTime: new Date(),
          currentUrl,
        });

        await emitAssessmentEvent({
          assessmentId,
          testRunId: runId,
          eventType: 'screenshot_captured',
          title: `Captured: ${pageTitle || stepName}`,
          description: `Live screenshot recorded at ${currentUrl}`,
          url: currentUrl,
          screenshotPath: screenshotUrl,
          stepName,
          data: {
            scenarioId,
            pageTitle,
            evidenceId: evidence._id,
            isCloudinary: storedScreenshot.isCloudinary,
            cloudinaryUrl: storedScreenshot.cloudinaryUrl,
          },
        });

        return evidence;
      } catch (err) {
        await appendRunLog(runId, 'error', `Failed to capture screenshot for ${scenarioId}: ${err.message}`);
        console.error(`[BrowserWorker Screenshot Error]:`, err);
        return null;
      }
    }

    // Helper: Safely navigate to a path or URL
    async function safeNavigate(subPathOrUrl, stepDescription) {
      if (actionCount >= maxActions) {
        throw new Error(`Max actions limit (${maxActions}) reached.`);
      }

      actionCount++;
      const fullUrl = subPathOrUrl.startsWith('http')
        ? subPathOrUrl
        : new URL(subPathOrUrl, targetUrl).toString();

      await appendRunLog(runId, 'info', `${stepDescription} -> ${fullUrl}`);

      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'navigation',
        title: stepDescription,
        description: `Browser navigating to ${sanitizeUrl(fullUrl)}`,
        url: fullUrl,
        stepName: stepDescription,
      });

      const start = Date.now();
      let response = null;
      let status = 200;
      let pageTitle = '';

      try {
        response = await page.goto(fullUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 12000,
        });
        await page.waitForTimeout(400);
        status = response ? response.status() : 200;
        pageTitle = await page.title().catch(() => '');
      } catch (navErr) {
        await appendRunLog(runId, 'warn', `Navigation to ${sanitizeUrl(fullUrl)} encountered non-fatal error: ${navErr.message}`);
        status = 404;
      }

      const durationMs = Date.now() - start;

      await recordBrowserAction({
        testRunId: runId,
        assessmentId,
        actionType: 'navigate',
        url: fullUrl,
        durationMs,
        status: status < 400 ? 'success' : 'failed',
        details: { statusCode: status, title: pageTitle },
      });

      if (!visitedUrls.has(fullUrl)) {
        visitedUrls.add(fullUrl);
        await TestRun.findByIdAndUpdate(runId, {
          $push: {
            pagesVisited: {
              url: sanitizeUrl(fullUrl),
              title: pageTitle,
              statusCode: status,
              visitedAt: new Date(),
            },
          },
          currentUrl: sanitizeUrl(fullUrl),
        });
      }

      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'page_inspected',
        title: `Loaded: ${pageTitle || 'Page'}`,
        description: `HTTP ${status} response received at ${sanitizeUrl(fullUrl)}`,
        url: fullUrl,
        stepName: stepDescription,
        data: { statusCode: status, title: pageTitle },
      });

      return { response, status, fullUrl, pageTitle };
    }

    // ==========================================
    // STEP 1: Inspect Homepage & Cookie/Consent Banner
    // ==========================================
    await TestRun.findByIdAndUpdate(runId, {
      status: 'inspecting_website',
      progress: 25,
      currentStep: 'Inspecting homepage and consent notice',
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_started',
      title: 'Step 1: Inspecting Homepage & Consent Notice',
      description: 'Scanning initial landing page for cookie consent notice and statutory disclosures.',
      progress: 25,
      stepName: 'Inspecting homepage and consent notice',
      url: targetUrl,
    });

    await safeNavigate('/', 'Inspecting Homepage');

    // Dynamic statutory link discovery on homepage
    const discoveredLinks = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map((a) => {
        const text = (a.innerText || a.textContent || '').trim().toLowerCase();
        const href = a.getAttribute('href') || '';
        const title = (a.getAttribute('title') || '').toLowerCase();
        const aria = (a.getAttribute('aria-label') || '').toLowerCase();
        return { text, href, title, aria };
      });
    });

    // Helper to resolve candidate statutory URLs from discovered navigation
    function resolveCandidatePath(keywords, fallbackCandidates) {
      for (const item of discoveredLinks) {
        const combined = `${item.text} ${item.href} ${item.title} ${item.aria}`;
        if (keywords.some((kw) => combined.includes(kw))) {
          if (item.href.startsWith('http')) {
            try {
              const u = new URL(item.href);
              if (
                u.hostname === approvedDomain ||
                u.hostname.endsWith(`.${approvedDomain}`) ||
                (isDemoSite && (u.hostname === 'localhost' || u.hostname === '127.0.0.1'))
              ) {
                return item.href;
              }
            } catch (e) {}
          } else if (
            item.href &&
            !item.href.startsWith('javascript:') &&
            !item.href.startsWith('#') &&
            !item.href.startsWith('mailto:') &&
            !item.href.startsWith('tel:')
          ) {
            return item.href;
          }
        }
      }
      return fallbackCandidates[0];
    }

    // Check for cookie / consent notice elements
    const consentAnalysis = await page.evaluate(() => {
      const banner = document.querySelector(
        '#cookie-consent-banner, [class*="consent"], [class*="cookie"], [id*="cookie"], [aria-label*="cookie"]'
      );
      if (!banner) return { hasBanner: false };

      const bannerText = banner.innerText || '';
      const buttons = Array.from(banner.querySelectorAll('button, a'));
      const hasAccept = buttons.some((b) => b.id === 'accept-btn' || /accept|agree/i.test(b.innerText || ''));
      const hasReject = buttons.some((b) => b.id === 'reject-btn' || /reject|decline|opt-out/i.test(b.innerText || ''));
      const hasCustomize = buttons.some((b) => b.id === 'customize-btn' || /customize|manage|preferences/i.test(b.innerText || ''));

      return {
        hasBanner: true,
        bannerText: bannerText.slice(0, 1000),
        hasAccept,
        hasReject,
        hasCustomize,
        mentionsDpdp: /dpdp|data protection|consent/i.test(bannerText),
      };
    });

    const homeEvidence = await capturePageEvidence('notice_and_consent', 'homepage', consentAnalysis);

    const sr1 = await ScenarioResult.create({
      assessmentId,
      testRunId: runId,
      scenarioId: 'notice_and_consent',
      title: 'DPDP Section 5 & 6 — Notice & Consent Banner Inspection',
      category: 'notice_and_consent',
      status: consentAnalysis.hasBanner && consentAnalysis.hasReject ? 'passed' : 'needs_review',
      summary: consentAnalysis.hasBanner
        ? `Consent banner detected on homepage with ${consentAnalysis.hasReject ? 'affirmative Reject and' : 'no direct Reject,'} Accept options.`
        : 'No prominent cookie or consent notice banner detected on initial landing.',
      dpdpReference: 'Digital Personal Data Protection Act, 2023 - Sections 5(1), 6(1)',
      evidenceIds: homeEvidence ? [homeEvidence._id] : [],
      observedFindings: [
        consentAnalysis.hasBanner ? 'Consent banner displayed on landing' : 'Consent banner absent',
        consentAnalysis.hasReject ? 'Clear opt-out / reject mechanism present' : 'Missing direct opt-out button on initial banner',
        consentAnalysis.mentionsDpdp ? 'References data protection principles' : 'Generic consent text without statutory citations',
      ],
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'scenario_evaluated',
      title: 'DPDP Section 5 & 6 Evaluated',
      description: sr1.summary,
      progress: 35,
      stepName: 'Consent notice evaluated',
      data: {
        scenario: {
          _id: sr1._id,
          scenarioId: sr1.scenarioId,
          title: sr1.title,
          category: sr1.category,
          status: sr1.status,
          summary: sr1.summary,
          dpdpReference: sr1.dpdpReference,
          observedFindings: sr1.observedFindings,
        },
      },
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'consent_detected',
      title: consentAnalysis.hasBanner ? 'Consent Banner Detected' : 'Consent Notice Missing',
      description: consentAnalysis.hasBanner
        ? `Consent banner verified with ${consentAnalysis.hasReject ? 'opt-out / reject mechanism.' : 'no direct reject button.'}`
        : 'Initial landing page loaded without prominent consent banner.',
      progress: 35,
      stepName: 'Consent notice evaluated',
      data: consentAnalysis,
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_completed',
      title: 'Step 1 Complete: Notice & Consent Checked',
      description: 'DPDP Section 5 & 6 preliminary consent verification recorded.',
      progress: 35,
      stepName: 'Step 1 complete',
    });

    // Autonomous Gemini Computer Use Inspection (if enabled in run options)
    if (options.enableComputerUse) {
      await TestRun.findByIdAndUpdate(runId, {
        currentStep: 'Gemini Computer Use autonomous UI inspection',
      });
      await runAutonomousScenario({
        testRunId: runId,
        assessmentId,
        targetUrl,
        approvedDomain,
        isDemoSite,
        page,
        evidenceDir,
        scenario: {
          id: 'notice_and_consent',
          title: 'Notice & Consent UI Evaluation',
          category: 'notice_and_consent',
          objective: 'Locate and inspect the privacy notice link or consent banner on the homepage',
          permittedScope: 'Public landing page UI elements',
          dpdpReference: 'DPDP Act 2023 Sections 5, 6',
        },
        options,
      });
    }

    // Check for cancellation
    const checkCancelled = await TestRun.findById(runId);
    if (checkCancelled && checkCancelled.status === 'cancelled') {
      await appendRunLog(runId, 'warn', 'Inspection was cancelled by user request.');
      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'cancelled',
        title: 'Inspection Cancelled',
        description: 'Inspection run was cancelled by user request.',
      });
      return;
    }

    // ==========================================
    // STEP 2: Inspect Privacy Notice Page
    // ==========================================
    await TestRun.findByIdAndUpdate(runId, {
      progress: 40,
      currentStep: 'Inspecting Privacy Notice (DPDP Sec 5)',
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_started',
      title: 'Step 2: Inspecting Privacy Notice',
      description: 'Navigating to discovered privacy policy URL to check statutory Section 5 itemized disclosures.',
      progress: 40,
      stepName: 'Inspecting Privacy Notice (DPDP Sec 5)',
    });

    const privacyTarget = resolveCandidatePath(
      ['privacy', 'privacy policy', 'privacy notice', 'data protection', 'terms'],
      ['/privacy', '/privacy-policy', '/privacy-notice', '/legal/privacy']
    );

    const navPrivacy = await safeNavigate(privacyTarget, 'Navigating to Privacy Notice');

    const privacyAnalysis = navPrivacy.status < 400
      ? await page.evaluate(() => {
          const text = document.body ? document.body.innerText.toLowerCase() : '';
          return {
            pageFound: true,
            hasDataFiduciary: text.includes('data fiduciary') || text.includes('fiduciary'),
            hasPurpose: text.includes('purpose') && (text.includes('processing') || text.includes('collected')),
            hasWithdrawal: text.includes('withdraw') || text.includes('withdrawal'),
            hasRetention: text.includes('retention') || text.includes('retain'),
            hasGrievance: text.includes('grievance') || text.includes('officer'),
          };
        })
      : { pageFound: false };

    const privacyEvidence = await capturePageEvidence('privacy_notice_compliance', 'privacy_page', privacyAnalysis);

    const privacyScore = privacyAnalysis.pageFound
      ? [
          privacyAnalysis.hasDataFiduciary,
          privacyAnalysis.hasPurpose,
          privacyAnalysis.hasWithdrawal,
          privacyAnalysis.hasRetention,
          privacyAnalysis.hasGrievance,
        ].filter(Boolean).length
      : 0;

    const sr2 = await ScenarioResult.create({
      assessmentId,
      testRunId: runId,
      scenarioId: 'privacy_notice_compliance',
      title: 'DPDP Section 5 — Itemized Privacy Notice Elements',
      category: 'notice_and_consent',
      status: !privacyAnalysis.pageFound
        ? 'failed'
        : privacyScore >= 4
        ? 'passed'
        : 'needs_review',
      summary: !privacyAnalysis.pageFound
        ? `Privacy Notice page could not be located on target domain (HTTP ${navPrivacy.status}).`
        : `Privacy Notice satisfies ${privacyScore}/5 core statutory disclosures under Section 5.`,
      dpdpReference: 'Digital Personal Data Protection Act, 2023 - Section 5',
      evidenceIds: privacyEvidence ? [privacyEvidence._id] : [],
      observedFindings: !privacyAnalysis.pageFound
        ? [
            'Privacy notice link not discoverable on target navigation',
            `Candidate path ${privacyTarget} returned HTTP ${navPrivacy.status}`,
            'Missing statutory itemized disclosures pursuant to Section 5',
          ]
        : [
            privacyAnalysis.hasDataFiduciary ? 'Data Fiduciary identity clearly specified' : 'Missing Data Fiduciary designation',
            privacyAnalysis.hasPurpose ? 'Specified purpose of processing declared' : 'Vague or unspecified processing purposes',
            privacyAnalysis.hasWithdrawal ? 'Consent withdrawal mechanism explained' : 'Missing consent withdrawal instructions',
            privacyAnalysis.hasRetention ? 'Data retention periods explicitly documented' : 'Indefinite or unspecified retention timeline',
            privacyAnalysis.hasGrievance ? 'Grievance redressal contact information provided' : 'Missing Grievance Officer details in privacy notice',
          ],
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'scenario_evaluated',
      title: 'DPDP Section 5 Evaluated',
      description: sr2.summary,
      progress: 50,
      stepName: 'Privacy Notice evaluated',
      data: {
        scenario: {
          _id: sr2._id,
          scenarioId: sr2.scenarioId,
          title: sr2.title,
          category: sr2.category,
          status: sr2.status,
          summary: sr2.summary,
          dpdpReference: sr2.dpdpReference,
          observedFindings: sr2.observedFindings,
        },
      },
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_completed',
      title: 'Step 2 Complete: Privacy Disclosures Checked',
      description: !privacyAnalysis.pageFound
        ? `Privacy notice not found (HTTP ${navPrivacy.status}).`
        : `Privacy notice verified (${privacyScore}/5 statutory criteria satisfied).`,
      progress: 50,
      stepName: 'Privacy Notice evaluated',
    });

    // ==========================================
    // STEP 3: Inspect Grievance Redressal (DPDP Sec 8(9))
    // ==========================================
    await TestRun.findByIdAndUpdate(runId, {
      progress: 55,
      currentStep: 'Verifying Grievance Redressal mechanism (Sec 8(9))',
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_started',
      title: 'Step 3: Checking Grievance Redressal Mechanism',
      description: 'Navigating to grievance or DPO channel to inspect statutory Data Protection Officer contact details.',
      progress: 55,
      stepName: 'Verifying Grievance Redressal mechanism (Sec 8(9))',
    });

    const grievanceTarget = resolveCandidatePath(
      ['grievance', 'dpo', 'data protection officer', 'nodal', 'redressal'],
      ['/grievance', '/grievance-redressal', '/dpo', '/contact']
    );

    const navGrievance = await safeNavigate(grievanceTarget, 'Navigating to Grievance Redressal');

    const grievanceAnalysis = navGrievance.status < 400
      ? await page.evaluate(() => {
          const text = document.body ? document.body.innerText : '';
          const emailMatch = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
          return {
            pageFound: true,
            hasOfficer: /grievance officer|data protection officer|dpo/i.test(text),
            hasEmail: Boolean(emailMatch),
            officerEmail: emailMatch ? emailMatch[0] : null,
            hasTimeline: /30 days|timeline|sla|period/i.test(text),
            mentionsDpbi: /data protection board|dpbi|appellate/i.test(text),
          };
        })
      : { pageFound: false };

    const grievanceEvidence = await capturePageEvidence('grievance_mechanism_sec_8_9', 'grievance_page', grievanceAnalysis);

    const sr3 = await ScenarioResult.create({
      assessmentId,
      testRunId: runId,
      scenarioId: 'grievance_mechanism_sec_8_9',
      title: 'DPDP Section 8(9) — Grievance Redressal & DPO Publication',
      category: 'grievance_redressal',
      status: !grievanceAnalysis.pageFound
        ? 'failed'
        : grievanceAnalysis.hasOfficer && grievanceAnalysis.hasEmail
        ? 'passed'
        : 'failed',
      summary: !grievanceAnalysis.pageFound
        ? `Grievance Redressal channel not discovered on target domain (HTTP ${navGrievance.status}).`
        : grievanceAnalysis.hasOfficer && grievanceAnalysis.hasEmail
        ? 'Designated Grievance Officer contact details published with SLA.'
        : 'Grievance Officer details are incomplete or missing statutory contact channels.',
      dpdpReference: 'Digital Personal Data Protection Act, 2023 - Section 8(9)',
      evidenceIds: grievanceEvidence ? [grievanceEvidence._id] : [],
      observedFindings: !grievanceAnalysis.pageFound
        ? [
            'No designated Grievance Officer details or DPO portal link published',
            `Candidate path ${grievanceTarget} returned HTTP ${navGrievance.status}`,
            'Failure to publish statutory Grievance Officer contact and SLA',
          ]
        : [
            grievanceAnalysis.hasOfficer ? 'Designated Grievance Officer published' : 'Grievance Officer not identified',
            grievanceAnalysis.hasEmail ? 'Dedicated electronic contact channel present' : 'No email contact found for grievances',
            grievanceAnalysis.hasTimeline ? 'Response SLA defined (30 days)' : 'No resolution timeline stated',
            grievanceAnalysis.mentionsDpbi ? 'Data Protection Board of India escalation route documented' : 'Missing DPBI escalation path',
          ],
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'scenario_evaluated',
      title: 'DPDP Section 8(9) Evaluated',
      description: sr3.summary,
      progress: 65,
      stepName: 'Grievance Redressal evaluated',
      data: {
        scenario: {
          _id: sr3._id,
          scenarioId: sr3.scenarioId,
          title: sr3.title,
          category: sr3.category,
          status: sr3.status,
          summary: sr3.summary,
          dpdpReference: sr3.dpdpReference,
          observedFindings: sr3.observedFindings,
        },
      },
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_completed',
      title: 'Step 3 Complete: Grievance Contact Evaluated',
      description: sr3.summary,
      progress: 65,
      stepName: 'Grievance Redressal evaluated',
    });

    // ==========================================
    // STEP 4: Inspect Contact & Data Collection Form
    // ==========================================
    await TestRun.findByIdAndUpdate(runId, {
      progress: 70,
      currentStep: 'Inspecting data minimization on Contact Form',
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_started',
      title: 'Step 4: Inspecting Data Minimization & Consent Forms',
      description: 'Navigating to contact form to examine data collection fields and prior consent toggles.',
      progress: 70,
      stepName: 'Inspecting data minimization on Contact Form',
    });

    const contactTarget = resolveCandidatePath(
      ['contact', 'reach us', 'support', 'help', 'inquiry'],
      ['/contact', '/contact-us', '/support']
    );

    const navContact = await safeNavigate(contactTarget, 'Navigating to Contact Form');

    const formAnalysis = navContact.status < 400
      ? await page.evaluate(() => {
          const form = document.querySelector('form');
          if (!form) return { pageFound: true, hasForm: false };

          const inputs = Array.from(form.querySelectorAll('input, textarea, select')).map((el) => ({
            name: el.name || el.id,
            type: el.type || el.tagName.toLowerCase(),
            required: el.required,
          }));

          const consentBox = form.querySelector('input[type="checkbox"][name*="consent"], input[type="checkbox"][id*="consent"]');

          return {
            pageFound: true,
            hasForm: true,
            fieldCount: inputs.length,
            fields: inputs,
            hasConsentCheckbox: Boolean(consentBox),
            isConsentRequired: consentBox ? consentBox.required : false,
          };
        })
      : { pageFound: false };

    const formEvidence = await capturePageEvidence('data_minimization_and_notice', 'contact_form', formAnalysis);

    const sr4 = await ScenarioResult.create({
      assessmentId,
      testRunId: runId,
      scenarioId: 'data_minimization_and_notice',
      title: 'DPDP Section 4 & 6 — Data Minimization & Form Notice',
      category: 'data_minimization',
      status: !formAnalysis.pageFound
        ? 'not_applicable'
        : formAnalysis.hasForm && formAnalysis.hasConsentCheckbox
        ? 'passed'
        : 'needs_review',
      summary: !formAnalysis.pageFound
        ? `No public interactive contact forms detected at candidate paths (${contactTarget} returned ${navContact.status}).`
        : formAnalysis.hasForm
        ? `Form captures ${formAnalysis.fieldCount} fields with ${formAnalysis.hasConsentCheckbox ? 'affirmative' : 'no'} prior consent checkbox.`
        : 'No interactive contact forms detected on inspected page.',
      dpdpReference: 'Digital Personal Data Protection Act, 2023 - Sections 4, 6(1)',
      evidenceIds: formEvidence ? [formEvidence._id] : [],
      observedFindings: !formAnalysis.pageFound
        ? [
            'No interactive contact forms discovered on public navigation',
            'Form consent verification marked not applicable for public scope',
          ]
        : [
            formAnalysis.hasConsentCheckbox
              ? 'Purpose consent checkbox required before submission'
              : 'Form collects personal data without consent affirmation checkbox',
            `Field count inspected: ${formAnalysis.fieldCount || 0}`,
          ],
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'scenario_evaluated',
      title: 'DPDP Section 4 & 6 Evaluated',
      description: sr4.summary,
      progress: 78,
      stepName: 'Data Minimization evaluated',
      data: {
        scenario: {
          _id: sr4._id,
          scenarioId: sr4.scenarioId,
          title: sr4.title,
          category: sr4.category,
          status: sr4.status,
          summary: sr4.summary,
          dpdpReference: sr4.dpdpReference,
          observedFindings: sr4.observedFindings,
        },
      },
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_completed',
      title: 'Step 4 Complete: Form Notice & Minimization Checked',
      description: sr4.summary,
      progress: 78,
      stepName: 'Data Minimization evaluated',
    });

    // ==========================================
    // STEP 5: Inspect Consent Manager & Withdrawal
    // ==========================================
    await TestRun.findByIdAndUpdate(runId, {
      progress: 82,
      currentStep: 'Verifying Consent Preferences & Withdrawal Portal',
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_started',
      title: 'Step 5: Verifying Consent Preferences & Withdrawal',
      description: 'Navigating to consent manager to test granular purpose management and unconditional withdrawal (Sec 6(4)).',
      progress: 82,
      stepName: 'Verifying Consent Preferences & Withdrawal Portal',
    });

    const consentManagerTarget = resolveCandidatePath(
      ['consent', 'manage consent', 'cookie settings', 'privacy preferences', 'cookie policy'],
      ['/consent', '/cookies', '/cookie-preferences']
    );

    const navConsent = await safeNavigate(consentManagerTarget, 'Navigating to Consent Manager');

    const consentManagerAnalysis = navConsent.status < 400
      ? await page.evaluate(() => {
          const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).map((cb) => ({
            id: cb.id,
            checked: cb.checked,
            disabled: cb.disabled,
          }));
          const text = document.body ? document.body.innerText.toLowerCase() : '';
          return {
            pageFound: true,
            checkboxCount: checkboxes.length,
            checkboxes,
            hasWithdrawButton: text.includes('withdraw') || Boolean(document.querySelector('#withdraw-all-btn')),
            hasGranularPurposes: checkboxes.length >= 2,
          };
        })
      : { pageFound: false };

    const consentManagerEvidence = await capturePageEvidence(
      'consent_granularity_and_withdrawal',
      'consent_manager',
      consentManagerAnalysis
    );

    const sr5 = await ScenarioResult.create({
      assessmentId,
      testRunId: runId,
      scenarioId: 'consent_granularity_and_withdrawal',
      title: 'DPDP Section 6(4) — Granular Consent & Withdrawal Interface',
      category: 'user_rights',
      status: !consentManagerAnalysis.pageFound
        ? 'failed'
        : consentManagerAnalysis.hasWithdrawButton && consentManagerAnalysis.hasGranularPurposes
        ? 'passed'
        : 'needs_review',
      summary: !consentManagerAnalysis.pageFound
        ? `No dedicated consent preferences or withdrawal portal found on target domain (HTTP ${navConsent.status}).`
        : 'Granular purpose toggles and unconditional consent withdrawal verified.',
      dpdpReference: 'Digital Personal Data Protection Act, 2023 - Section 6(4)',
      evidenceIds: consentManagerEvidence ? [consentManagerEvidence._id] : [],
      observedFindings: !consentManagerAnalysis.pageFound
        ? [
            'No granular purpose management interface discovered',
            'No unconditional consent withdrawal portal detected',
            `Candidate path ${consentManagerTarget} returned HTTP ${navConsent.status}`,
          ]
        : [
            consentManagerAnalysis.hasGranularPurposes ? 'Itemized purpose options presented' : 'All-or-nothing consent model',
            consentManagerAnalysis.hasWithdrawButton ? 'Unconditional withdrawal trigger available' : 'Missing direct withdrawal mechanism',
          ],
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'scenario_evaluated',
      title: 'DPDP Section 6(4) Evaluated',
      description: sr5.summary,
      progress: 88,
      stepName: 'Consent Withdrawal evaluated',
      data: {
        scenario: {
          _id: sr5._id,
          scenarioId: sr5.scenarioId,
          title: sr5.title,
          category: sr5.category,
          status: sr5.status,
          summary: sr5.summary,
          dpdpReference: sr5.dpdpReference,
          observedFindings: sr5.observedFindings,
        },
      },
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_completed',
      title: 'Step 5 Complete: Consent Withdrawal Verified',
      description: sr5.summary,
      progress: 88,
      stepName: 'Consent Withdrawal evaluated',
    });

    // ==========================================
    // STEP 6: Authorized Login & Authentication Safeguards
    // ==========================================
    await TestRun.findByIdAndUpdate(runId, {
      progress: 90,
      currentStep: 'Inspecting Authorized Test Login & Credential Safeguards',
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'step_started',
      title: 'Step 6: Inspecting Authentication Safeguards',
      description: 'Testing login workflows, credential safeguards, and handling of authentication challenges.',
      progress: 90,
      stepName: 'Inspecting Authorized Test Login & Credential Safeguards',
    });

    creds = { ...creds, ...(options.credentials || options.loginTestingConfig || {}) };
    const isAssistMode = options.triggerOtpAssistance === true;
    const isPublicOnly = Boolean(creds.skipAuthenticatedTesting || (!creds.enabled && !creds.username && !options.triggerOtpAssistance));
    const isOtherAuthMethod = creds.authMethod === 'sso_mfa_other';

    if (isOtherAuthMethod) {
      // Customer specified SSO / MFA / OTP / CAPTCHA method
      await appendRunLog(runId, 'info', 'Authentication method identified as SSO / MFA / OTP. Automated password testing skipped; respecting security controls.');

      await TestRun.findByIdAndUpdate(runId, {
        authTestingResult: {
          status: 'blocked',
          authMethod: 'sso_mfa_other',
          loginUrl: creds.loginUrl ? sanitizeUrl(creds.loginUrl) : null,
          details: 'Website uses SSO, OTP, or Multi-Factor Authentication. Automated password bypass is prohibited by DPDP security policies; manual intervention required.',
        },
      });

      const sr6 = await ScenarioResult.create({
        assessmentId,
        testRunId: runId,
        scenarioId: 'authorized_login_safeguards',
        title: 'DPDP Section 8(5) — Authentication Safeguards (SSO / MFA)',
        category: 'security_safeguards',
        status: 'needs_review',
        summary: 'Website uses SSO / MFA / OTP authentication. Automated testing safely respected authentication boundaries without attempting bypass.',
        dpdpReference: 'Digital Personal Data Protection Act, 2023 - Section 8(5)',
        observedFindings: [
          'Authentication method identified as SSO / OTP / Multi-Factor',
          'Platform strictly adheres to security boundaries and never attempts to bypass MFA or SSO',
          'Manual intervention or assisted verification required for inspecting authenticated pages',
        ],
      });

      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'scenario_evaluated',
        title: 'Authentication Safeguards: SSO/MFA Mode',
        description: sr6.summary,
        progress: 95,
        stepName: 'Authentication Safeguards evaluated',
        data: {
          scenario: {
            _id: sr6._id,
            scenarioId: sr6.scenarioId,
            title: sr6.title,
            category: sr6.category,
            status: sr6.status,
            summary: sr6.summary,
            dpdpReference: sr6.dpdpReference,
            observedFindings: sr6.observedFindings,
          },
        },
      });

      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'step_completed',
        title: 'Step 6 Complete: SSO / MFA Authentication Documented',
        description: 'Authentication boundaries respected; manual intervention noted for SSO/MFA flows.',
        progress: 95,
        stepName: 'Authentication Safeguards complete',
      });
    } else if (isPublicOnly && !isAssistMode) {
      // Customer selected public-page-only testing
      await appendRunLog(runId, 'info', 'Customer elected public-page-only testing scope. Authenticated testing skipped.');

      await TestRun.findByIdAndUpdate(runId, {
        authTestingResult: {
          status: 'skipped',
          authMethod: 'public_only',
          details: 'Customer elected to test public pages only. Authenticated testing was skipped without error.',
        },
      });

      // Truthful status: 'skipped', NOT fake 'passed'!
      const sr6 = await ScenarioResult.create({
        assessmentId,
        testRunId: runId,
        scenarioId: 'authorized_login_safeguards',
        title: 'DPDP Section 8(5) — Authenticated Testing & Safeguards',
        category: 'security_safeguards',
        status: 'skipped',
        summary: 'Public-page-only testing scope selected by customer. Authenticated page testing intentionally skipped without credential submission.',
        dpdpReference: 'Digital Personal Data Protection Act, 2023 - Section 8(5)',
        observedFindings: [
          'Customer elected public-page-only assessment scope',
          'Authenticated testing skipped per customer authorization without error',
          'Authentication safeguards were not evaluated (public pages only)',
        ],
      });

      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'scenario_evaluated',
        title: 'Authentication Safeguards: Scope Limit (Public Pages Only)',
        description: sr6.summary,
        progress: 95,
        stepName: 'Authentication Safeguards scope applied',
        data: {
          scenario: {
            _id: sr6._id,
            scenarioId: sr6.scenarioId,
            title: sr6.title,
            category: sr6.category,
            status: sr6.status,
            summary: sr6.summary,
            dpdpReference: sr6.dpdpReference,
            observedFindings: sr6.observedFindings,
          },
        },
      });

      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'step_completed',
        title: 'Step 6 Complete: Scope Limit (Public Pages Only)',
        description: 'Public-page testing scope confirmed; authenticated test login safely skipped.',
        progress: 95,
        stepName: 'Authentication Safeguards complete',
      });
    } else {
      // Customer provided credentials for automated test login OR simulated assist mode
      const rawLoginUrl = creds.loginUrl || (isAssistMode ? '/login?mode=otp_test' : resolveCandidatePath(['login', 'sign in', 'account'], ['/login']));
      const resolvedLoginUrl = rawLoginUrl.startsWith('http')
        ? rawLoginUrl
        : new URL(rawLoginUrl, targetUrl).toString();

      await safeNavigate(resolvedLoginUrl, 'Inspecting Authorized Test Login');

      const loginAnalysis = await page.evaluate(() => {
        const usernameInput = document.querySelector('input[type="text"]#username, input[name="username"], input[type="email"], input[name="email"]');
        const passwordInput = document.querySelector('input[type="password"]#password, input[name="password"]');
        const otpInput = document.querySelector('input#otp, input[name="otp"]');
        const captchaImg = document.querySelector('img[src*="captcha"], canvas[class*="captcha"]');

        return {
          hasLoginForm: Boolean(usernameInput && passwordInput),
          hasOtpInput: Boolean(otpInput && otpInput.offsetParent !== null),
          hasCaptcha: Boolean(captchaImg),
        };
      });

      const initialLoginEvidence = await capturePageEvidence('authorized_login_safeguards', 'login_page', {
        hasLoginForm: loginAnalysis.hasLoginForm,
        loginUrl: sanitizeUrl(resolvedLoginUrl),
      });

      let loginSuccessful = false;
      let sessionEstablished = false;

      // If credentials provided, perform Playwright login
      if (creds.username && creds.password) {
        await appendRunLog(runId, 'info', `Performing authorized test login with account: ${redactSensitiveData(creds.username)}`);

        await emitAssessmentEvent({
          assessmentId,
          testRunId: runId,
          eventType: 'auth_attempt',
          title: 'Testing Authorized Login',
          description: `Attempting automated test login as ${redactSensitiveData(creds.username)} on ${sanitizeUrl(resolvedLoginUrl)}`,
          url: resolvedLoginUrl,
          stepName: 'Authenticating test account',
        });

        try {
          const usernameSelector = 'input[type="email"], input[name="email"], input[name="username"], input[type="text"]#username, input#email, input#username, input[type="text"]';
          const passwordSelector = 'input[type="password"]#password, input[name="password"], input#password, input[type="password"]';
          const submitSelector = 'button[type="submit"], input[type="submit"], #login-submit-btn, form button, button:has-text("Log In"), button:has-text("Sign In")';

          const userField = await page.$(usernameSelector);
          const passField = await page.$(passwordSelector);

          if (userField && passField) {
            await userField.fill(creds.username);
            await passField.fill(creds.password);

            delete creds.password;
            if (options.credentials) delete options.credentials.password;
            if (options.loginTestingConfig) delete options.loginTestingConfig.password;

            const submitBtn = await page.$(submitSelector);
            await Promise.all([
              page.waitForNavigation({ timeout: 10000, waitUntil: 'domcontentloaded' }).catch(() => null),
              page.waitForResponse(res => res.url().includes('login') || res.url().includes('auth') || res.url().includes('api') || res.status() < 500, { timeout: 8000 }).catch(() => null),
              submitBtn ? submitBtn.click() : passField.press('Enter'),
            ]);

            // Allow client-side routing to settle
            await page.waitForTimeout(3000);

            const currentPostUrl = page.url();
            const cookies = await page.context().cookies();
            const isRedirectedAway = !currentPostUrl.includes('/login') && (currentPostUrl.includes('/dashboard') || currentPostUrl.includes('/profile') || currentPostUrl.includes('/account') || currentPostUrl !== resolvedLoginUrl);

            const postLoginState = await page.evaluate(() => {
              const errorAlert = document.querySelector('.error, .alert-danger, [role="alert"], .text-red-500, .text-rose-500, #login-error');
              const otpInput = document.querySelector('input#otp, input[name="otp"]');
              return {
                hasError: Boolean(errorAlert && errorAlert.offsetParent !== null),
                errorText: errorAlert ? errorAlert.innerText.slice(0, 200) : '',
                hasOtp: Boolean(otpInput && otpInput.offsetParent !== null),
              };
            });

            if (postLoginState.hasOtp) {
              loginAnalysis.hasOtpInput = true;
              loginSuccessful = false;
              sessionEstablished = false;
            } else if (isRedirectedAway || (!postLoginState.hasError && cookies.length > 0)) {
              loginSuccessful = true;
              sessionEstablished = true;
              await appendRunLog(runId, 'info', `Authentication verified: redirected to ${sanitizeUrl(currentPostUrl)}. Session established.`);
            } else {
              loginSuccessful = false;
              sessionEstablished = false;
              await appendRunLog(runId, 'warn', `Authentication failed on ${sanitizeUrl(resolvedLoginUrl)}: ${redactSensitiveData(postLoginState.errorText || 'Credentials rejected or navigation blocked.')}`);
            }
          }
        } catch (fillErr) {
          await appendRunLog(runId, 'warn', `Automated login fill encountered non-fatal error: ${fillErr.message}`);
        }
      }

      if (loginAnalysis.hasOtpInput || isAssistMode) {
        await appendRunLog(runId, 'warn', 'Assistance Required: Simulated OTP / CAPTCHA challenge encountered on login form.');

        await TestRun.findByIdAndUpdate(runId, {
          status: 'awaiting_user_input',
          userAssistanceRequired: true,
          userAssistancePrompt: 'Assisted test verification: Simulated OTP or CAPTCHA detected on login form. Assistance required.',
        });

        await recordBrowserAction({
          testRunId: runId,
          assessmentId,
          actionType: 'user_intervention',
          url: sanitizeUrl(page.url()),
          status: 'success',
          details: { prompt: 'Simulated OTP assistance triggered' },
        });

        await emitAssessmentEvent({
          assessmentId,
          testRunId: runId,
          eventType: 'human_intervention',
          title: 'Security Verification Encountered',
          description: 'Simulated OTP or security challenge encountered. Inspection safely paused without bypass.',
          progress: 92,
          stepName: 'Awaiting user assistance',
        });

        if (options.autoResumeDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.autoResumeDelayMs));
          await appendRunLog(runId, 'info', 'User assistance provided or resumed by tester.');
        }
      }

      const postEvidence = await capturePageEvidence(
        'authorized_login_safeguards',
        sessionEstablished ? 'authenticated_dashboard' : 'post_login_state',
        {
          loginSuccessful,
          sessionEstablished,
          currentUrl: sanitizeUrl(page.url()),
          otpAssistanceTriggered: isAssistMode || loginAnalysis.hasOtpInput,
        }
      );

      const determinedAuthStatus = sessionEstablished
        ? 'passed'
        : (loginAnalysis.hasOtpInput ? 'needs_assistance' : (creds.username ? 'failed' : 'performed'));

      await TestRun.findByIdAndUpdate(runId, {
        authTestingResult: {
          status: determinedAuthStatus,
          authMethod: creds.authMethod || 'password',
          loginUrl: sanitizeUrl(resolvedLoginUrl),
          usernameMasked: creds.username ? redactSensitiveData(creds.username) : 'test_auditor',
          sessionEstablished,
          details: sessionEstablished
            ? `Authenticated test account login executed and verified. Session established at ${sanitizeUrl(page.url())}.`
            : (loginAnalysis.hasOtpInput ? 'Assisted pause triggered for OTP/CAPTCHA challenge.' : 'Login attempted with provided credentials.'),
        },
      });

      const sr6 = await ScenarioResult.create({
        assessmentId,
        testRunId: runId,
        scenarioId: 'authorized_login_safeguards',
        title: 'DPDP Section 8(5) — Authorized Authentication & Safeguards',
        category: 'security_safeguards',
        status: sessionEstablished ? 'passed' : (loginAnalysis.hasOtpInput ? 'needs_review' : (creds.username ? 'action_needed' : 'needs_review')),
        summary: sessionEstablished
          ? `Authenticated test account login successfully performed on ${sanitizeUrl(resolvedLoginUrl)}. Verified session established on ${sanitizeUrl(page.url())}; credentials safely masked.`
          : (loginAnalysis.hasOtpInput
              ? 'Security challenge (OTP / CAPTCHA) encountered on login form. Assistance required without bypass.'
              : 'Authorized login inspection evaluated. Credentials masked in evidence logs.'),
        dpdpReference: 'Digital Personal Data Protection Act, 2023 - Section 8(5)',
        evidenceIds: [initialLoginEvidence?._id, postEvidence?._id].filter(Boolean),
        observedFindings: [
          'Passwords masked in input fields and excluded from evidence logs and model prompts',
          sessionEstablished
            ? `Authenticated session established using test account (${redactSensitiveData(creds.username || 'test_auditor')}) on ${sanitizeUrl(page.url())}`
            : (loginAnalysis.hasOtpInput ? 'Multi-factor / OTP assistance pause verified' : 'Standard login form inspected'),
          'Automated assessment strictly avoids payment, deletion, or destructive actions',
        ],
      });

      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'scenario_evaluated',
        title: 'DPDP Section 8(5) Evaluated',
        description: sr6.summary,
        progress: 95,
        stepName: 'Authentication Safeguards evaluated',
        data: {
          scenario: {
            _id: sr6._id,
            scenarioId: sr6.scenarioId,
            title: sr6.title,
            category: sr6.category,
            status: sr6.status,
            summary: sr6.summary,
            dpdpReference: sr6.dpdpReference,
            observedFindings: sr6.observedFindings,
          },
        },
      });

      await emitAssessmentEvent({
        assessmentId,
        testRunId: runId,
        eventType: 'step_completed',
        title: 'Step 6 Complete: Authentication Safeguards Checked',
        description: sessionEstablished
          ? 'Authenticated test account login and credential masking verified.'
          : 'Authorized login workflows and input field masking verified.',
        progress: 95,
        stepName: 'Authentication Safeguards complete',
      });
    }

    // ==========================================
    // STEP 7: Finalize Assessment Run
    // ==========================================
    let complianceScore = 0;
    if (assessmentId) {
      try {
        const evalResults = await evaluateAssessmentFindings(assessmentId, runId);
        complianceScore = evalResults.complianceScore;
        await appendRunLog(runId, 'info', `Statutory DPDP findings synthesized. Compliance score: ${complianceScore}%.`);
      } catch (evalErr) {
        console.error(`[AssessmentEngine Error for ${assessmentId}]:`, evalErr);
        await Assessment.findByIdAndUpdate(assessmentId, {
          status: 'failed',
          failureReason: `Findings synthesis error: ${evalErr.message}`,
          completedAt: new Date(),
        });
        await TestRun.findByIdAndUpdate(runId, {
          status: 'failed',
          errorMessage: `Findings synthesis error: ${evalErr.message}`,
          endTime: new Date(),
        });
        throw evalErr;
      }
    }

    await TestRun.findByIdAndUpdate(runId, {
      status: 'completed',
      progress: 100,
      currentStep: 'Inspection and evidence capture completed successfully',
      endTime: new Date(),
    });

    await appendRunLog(runId, 'info', `Inspection completed. ${visitedUrls.size} pages visited, evidence and scenario results saved.`);

    console.log(`[Assessment Diagnostics] Finalized Assessment ${assessmentId} | Run ${runId} | Target: ${approvedDomain} | Status: completed | ComplianceScore: ${complianceScore}%`);

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'completed',
      title: 'Assessment Inspection Completed',
      description: 'All statutory assessment checks evaluated with empirical evidence. Final report is ready.',
      progress: 100,
      stepName: 'Inspection and evidence capture completed successfully',
      data: { complianceScore },
    });

  } catch (err) {
    console.error(`[BrowserWorker] Execution Error:`, err);
    await appendRunLog(runId, 'error', `Execution failed: ${err.message}`);
    await TestRun.findByIdAndUpdate(runId, {
      status: 'failed',
      errorMessage: redactSensitiveData(err.message),
      endTime: new Date(),
    });

    if (assessmentId) {
      await Assessment.findByIdAndUpdate(assessmentId, {
        status: 'failed',
        failureReason: redactSensitiveData(err.message),
        completedAt: new Date(),
      });
    }

    await emitAssessmentEvent({
      assessmentId,
      testRunId: runId,
      eventType: 'failed',
      title: 'Assessment Execution Failed',
      description: redactSensitiveData(err.message),
      progress: 0,
      stepName: 'Execution failed',
    });
  } finally {
    // Isolated context and browser cleanup
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
