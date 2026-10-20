import fs from 'fs';
import path from 'path';
import TestRun from '../models/TestRun.js';
import BrowserAction from '../models/BrowserAction.js';
import Evidence from '../models/Evidence.js';
import ScenarioResult from '../models/ScenarioResult.js';
import StructuredObservation from '../models/StructuredObservation.js';
import { callGeminiComputerUse } from './gemini.js';
import { validateComputerUseAction } from './safety-controller.js';
import { redactSensitiveData, sanitizeUrl } from './evidence-redactor.js';
import { emitAssessmentEvent } from './event-bus.js';
import { captureAndStoreScreenshot } from './cloudinary.js';

/**
 * Executes an autonomous Gemini Computer Use evaluation loop on a scenario.
 * 
 * @param {object} params
 * @param {string} params.testRunId
 * @param {string} params.assessmentId
 * @param {string} params.targetUrl
 * @param {string} params.approvedDomain
 * @param {boolean} params.isDemoSite
 * @param {object} params.page - Playwright Page instance
 * @param {string} params.evidenceDir - Local disk path for screenshots
 * @param {object} params.scenario - { id, title, category, objective, permittedScope, dpdpReference }
 * @param {object} [params.options] - { maxSteps, autoResumeDelayMs, modelOverride }
 * @returns {Promise<{
 *   scenarioId: string,
 *   status: 'passed' | 'needs_review' | 'failed',
 *   stepsCompleted: number,
 *   observations: Array,
 *   summary: string
 * }>}
 */
export async function runAutonomousScenario({
  testRunId,
  assessmentId,
  targetUrl,
  approvedDomain,
  isDemoSite,
  page,
  evidenceDir,
  scenario,
  options = {},
}) {
  const maxSteps = options.maxSteps || 5;
  const observations = [];
  let stepCount = 0;
  let isCompleted = false;
  const viewport = page.viewportSize() || { width: 1280, height: 800 };

  const appendLog = async (level, message) => {
    try {
      await TestRun.findByIdAndUpdate(testRunId, {
        $push: {
          logs: {
            timestamp: new Date(),
            level,
            message: redactSensitiveData(message),
          },
        },
      });
    } catch {}
  };

  await appendLog('info', `[Gemini Agent] Starting autonomous loop for scenario: ${scenario.title}`);

  while (stepCount < maxSteps && !isCompleted) {
    stepCount++;
    const stepTimestamp = Date.now();
    const screenshotFilename = `gemini_${scenario.id}_step${stepCount}_${stepTimestamp}.png`;

    // 1. Capture current viewport screenshot and upload to Cloudinary (with local fallback)
    const storedScreenshot = await captureAndStoreScreenshot({
      page,
      runId: testRunId,
      filename: screenshotFilename,
      evidenceDir,
      scenarioId: scenario.id,
      stepName: `gemini_step_${stepCount}`,
    });

    const publicScreenshotUrl = storedScreenshot.screenshotUrl;
    const screenshotBase64 = fs.readFileSync(storedScreenshot.localFilePath).toString('base64');
    const currentUrl = sanitizeUrl(page.url());
    const pageTitle = await page.title();

    await TestRun.findByIdAndUpdate(testRunId, {
      latestScreenshot: publicScreenshotUrl,
      latestScreenshotUrl: currentUrl,
      latestScreenshotTime: new Date(),
      currentUrl,
    });

    await emitAssessmentEvent({
      assessmentId,
      testRunId,
      eventType: 'screenshot_captured',
      title: `AI Inspection Step ${stepCount}`,
      description: `Gemini Computer Use captured viewport on ${pageTitle || currentUrl}`,
      url: currentUrl,
      screenshotPath: publicScreenshotUrl,
      stepName: `Gemini step ${stepCount}: ${scenario.title}`,
      data: {
        stepCount,
        maxSteps,
        isCloudinary: storedScreenshot.isCloudinary,
        cloudinaryUrl: storedScreenshot.cloudinaryUrl,
      },
    });

    // 2. Call Gemini Computer Use
    await appendLog('debug', `[Gemini Agent Step ${stepCount}] Sending screenshot to Gemini for objective: ${scenario.objective}`);
    
    const geminiResponse = await callGeminiComputerUse({
      screenshotBase64,
      objective: scenario.objective,
      permittedScope: scenario.permittedScope,
      modelOverride: options.modelOverride,
    });

    if (!geminiResponse.success || !geminiResponse.action) {
      await appendLog('warn', `[Gemini Agent] Gemini did not return an action: ${geminiResponse.error || 'Empty response'}. Continuing inspection.`);
      break;
    }

    const proposedAction = geminiResponse.action;
    const modelUsed = geminiResponse.modelUsed;
    await appendLog('info', `[Gemini Model: ${modelUsed}] Proposed action: ${proposedAction.name} (${JSON.stringify(proposedAction.args)})`);

    // 3. Safety Controller Validation
    const validation = validateComputerUseAction(proposedAction, {
      approvedDomain,
      isDemoSite,
      viewport,
      stepCount,
      maxSteps,
    });

    if (validation.requiresHumanApproval) {
      // Pause for human verification
      await appendLog('warn', `[Safety Controller Pause]: ${validation.reason}`);
      await TestRun.findByIdAndUpdate(testRunId, {
        status: 'awaiting_user_input',
        userAssistanceRequired: true,
        userAssistancePrompt: validation.reason,
      });

      await BrowserAction.create({
        testRunId,
        assessmentId,
        actionType: 'user_intervention',
        url: currentUrl,
        status: 'success',
        details: { reason: validation.reason, proposedAction },
      });

      if (options.autoResumeDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.autoResumeDelayMs));
        await appendLog('info', `[Human Assistance] Resumed by operator.`);
      } else {
        // Stop here and wait for operator
        break;
      }
    }

    if (!validation.isApproved) {
      await appendLog('warn', `[Safety Controller Blocked]: ${validation.reason}`);
      await BrowserAction.create({
        testRunId,
        assessmentId,
        actionType: 'blocked_navigation',
        url: currentUrl,
        status: 'blocked',
        details: { reason: validation.reason, proposedAction },
      });
      break;
    }

    // 4. Execute validated action via Playwright
    const execAction = validation.actionType;
    const args = validation.sanitizedArgs;
    let executionResult = 'Executed successfully';

    try {
      if (execAction === 'click' || execAction === 'click_at') {
        await page.mouse.click(args.pixelX, args.pixelY);
        executionResult = `Clicked at (${args.pixelX}px, ${args.pixelY}px)`;
      } else if (execAction === 'move_cursor') {
        await page.mouse.move(args.pixelX, args.pixelY);
        executionResult = `Moved cursor to (${args.pixelX}px, ${args.pixelY}px)`;
      } else if (execAction === 'type' || execAction === 'input_text') {
        await page.keyboard.type(args.text);
        executionResult = `Typed: ${redactSensitiveData(args.text)}`;
      } else if (execAction === 'press_key' || execAction === 'key_press') {
        await page.keyboard.press(args.key || 'Enter');
        executionResult = `Pressed key: ${args.key || 'Enter'}`;
      } else if (execAction === 'scroll' || execAction === 'scroll_at') {
        await page.mouse.wheel(0, args.deltaY || 400);
        executionResult = `Scrolled viewport by ${args.deltaY || 400}px`;
      } else if (execAction === 'navigate') {
        await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        executionResult = `Navigated to ${args.url}`;
      } else if (execAction === 'terminate' || execAction === 'complete') {
        executionResult = 'Goal achieved, terminating scenario.';
        isCompleted = true;
      }

      await page.waitForTimeout(500); // Allow DOM animations to settle
    } catch (execErr) {
      executionResult = `Execution error: ${execErr.message}`;
      await appendLog('error', `[Playwright Error] Failed to execute ${execAction}: ${execErr.message}`);
    }

    // 5. Save Structured Observation
    const observation = await StructuredObservation.create({
      assessmentId,
      testRunId,
      scenarioId: scenario.id,
      pageUrl: currentUrl,
      screenshotReference: publicScreenshotUrl,
      observedUiElement: args.intent || proposedAction.name,
      actionTaken: {
        action: execAction,
        coordinates: args.pixelX ? { x: args.pixelX, y: args.pixelY } : null,
        intent: args.intent || null,
        modelUsed,
      },
      result: executionResult,
      confidence: 'high',
      redactionStatus: 'redacted',
    });

    observations.push(observation);

    // Save Evidence record
    const evidence = await Evidence.create({
      assessmentId,
      testRunId,
      scenarioId: scenario.id,
      evidenceType: 'screenshot',
      pageUrl: currentUrl,
      pageTitle,
      screenshotPath: publicScreenshotUrl,
      extractedContent: geminiResponse.thought || args.intent || executionResult,
      metadata: {
        action: execAction,
        modelUsed,
        stepCount,
        fileSize: storedScreenshot.fileSize,
        isCloudinary: storedScreenshot.isCloudinary,
        cloudinaryUrl: storedScreenshot.cloudinaryUrl,
        localUrlPath: storedScreenshot.localUrlPath,
      },
      redactionStatus: 'redacted',
    });

    await TestRun.findByIdAndUpdate(testRunId, {
      $inc: { evidenceCount: 1 },
    });

    // Save BrowserAction
    await BrowserAction.create({
      testRunId,
      assessmentId,
      actionType: execAction === 'navigate' ? 'navigate' : 'click',
      url: currentUrl,
      status: 'success',
      details: { model: modelUsed, intent: args.intent, result: executionResult },
    });
  }

  return {
    scenarioId: scenario.id,
    status: observations.length > 0 ? 'passed' : 'needs_review',
    stepsCompleted: stepCount,
    observations,
    summary: `Autonomous Gemini evaluation completed ${stepCount} steps. Generated ${observations.length} structured observations.`,
  };
}
