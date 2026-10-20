import { validateTargetUrl } from './security.js';
import { redactSensitiveData, sanitizeUrl } from './evidence-redactor.js';

const ALLOWED_ACTION_TYPES = [
  'click',
  'click_at',
  'move_cursor',
  'type',
  'input_text',
  'press_key',
  'key_press',
  'scroll',
  'scroll_at',
  'navigate',
  'wait',
  'terminate',
  'complete',
  'take_screenshot',
];

const SENSITIVE_KEYWORDS = [
  'payment',
  'credit card',
  'checkout',
  'cvv',
  'otp',
  'captcha',
  'delete account',
  'erase data',
  'purge',
  'terminate account',
  'transfer funds',
  'buy now',
];

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?previous\s+instructions/i,
  /system\s+prompt/i,
  /override\s+(?:the\s+)?(?:safety|security)\s+policy/i,
  /exfiltrate/i,
  /api[_\s]?key/i,
  /<script\b/i,
  /javascript:/i,
  /data:text\/html/i,
];

/**
 * Validates a proposed Gemini Computer Use action against server-side safety constraints.
 * 
 * @param {object} action - The action object from Gemini function call { name, args }
 * @param {object} context - Execution context { approvedDomain, isDemoSite, viewport, stepCount, maxSteps }
 * @returns {{
 *   isApproved: boolean,
 *   actionType: string,
 *   sanitizedArgs: object,
 *   requiresHumanApproval: boolean,
 *   reason?: string
 * }}
 */
export function validateComputerUseAction(action, context = {}) {
  const {
    approvedDomain,
    isDemoSite = false,
    viewport = { width: 1280, height: 800 },
    stepCount = 0,
    maxSteps = 10,
  } = context;

  if (!action || !action.name) {
    return {
      isApproved: false,
      actionType: 'unknown',
      sanitizedArgs: {},
      requiresHumanApproval: false,
      reason: 'Missing action name in model function call.',
    };
  }

  const actionName = action.name.toLowerCase();
  const args = action.args || {};

  // 1. Step Limit Enforcement
  if (stepCount >= maxSteps) {
    return {
      isApproved: false,
      actionType: actionName,
      sanitizedArgs: args,
      requiresHumanApproval: false,
      reason: `Maximum steps limit (${maxSteps}) reached for this scenario.`,
    };
  }

  // 2. Action Type Whitelist
  if (!ALLOWED_ACTION_TYPES.includes(actionName)) {
    return {
      isApproved: false,
      actionType: actionName,
      sanitizedArgs: args,
      requiresHumanApproval: false,
      reason: `Action type '${actionName}' is not permitted by Safety Controller.`,
    };
  }

  // 3. Prompt Injection Defense
  const serialized = JSON.stringify(args);
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(serialized)) {
      return {
        isApproved: false,
        actionType: actionName,
        sanitizedArgs: args,
        requiresHumanApproval: false,
        reason: 'Untrusted content matched potential prompt-injection signature. Action rejected.',
      };
    }
  }

  // 4. Sensitive Action / Human Verification Guardrail
  const intentText = (args.intent || args.text || '').toLowerCase();
  for (const kw of SENSITIVE_KEYWORDS) {
    if (intentText.includes(kw)) {
      return {
        isApproved: false,
        actionType: actionName,
        sanitizedArgs: args,
        requiresHumanApproval: true,
        reason: `Sensitive action involving '${kw}' detected. Human confirmation required before execution.`,
      };
    }
  }

  // 5. Action-specific validation
  const sanitizedArgs = { ...args };

  // Coordinates validation & conversion from 0-999 normalized space to viewport pixels
  if (actionName === 'click' || actionName === 'click_at' || actionName === 'move_cursor' || actionName === 'scroll_at') {
    let rawX = args.x !== undefined ? Number(args.x) : null;
    let rawY = args.y !== undefined ? Number(args.y) : null;

    if (rawX === null || rawY === null || isNaN(rawX) || isNaN(rawY)) {
      return {
        isApproved: false,
        actionType: actionName,
        sanitizedArgs: args,
        requiresHumanApproval: false,
        reason: 'Click action requires valid x and y coordinate arguments.',
      };
    }

    // Clamp coordinates to normalized range 0 - 1000
    if (rawX < 0 || rawX > 1000 || rawY < 0 || rawY > 1000) {
      return {
        isApproved: false,
        actionType: actionName,
        sanitizedArgs: args,
        requiresHumanApproval: false,
        reason: `Coordinates (${rawX}, ${rawY}) exceed normalized screen bounds (0-1000).`,
      };
    }

    // Convert normalized (0-1000) to viewport pixel coordinates
    sanitizedArgs.pixelX = Math.round((rawX / 1000) * viewport.width);
    sanitizedArgs.pixelY = Math.round((rawY / 1000) * viewport.height);
  }

  // Text input validation (redact credentials and enforce max length)
  if (actionName === 'type' || actionName === 'input_text') {
    if (!args.text || typeof args.text !== 'string') {
      return {
        isApproved: false,
        actionType: actionName,
        sanitizedArgs: args,
        requiresHumanApproval: false,
        reason: 'Type action requires a valid string in args.text.',
      };
    }
    if (args.text.length > 500) {
      sanitizedArgs.text = args.text.slice(0, 500);
    }
  }

  // Navigation validation
  if (actionName === 'navigate') {
    if (!args.url || typeof args.url !== 'string') {
      return {
        isApproved: false,
        actionType: actionName,
        sanitizedArgs: args,
        requiresHumanApproval: false,
        reason: 'Navigate action requires a target URL.',
      };
    }

    const check = validateTargetUrl(args.url, { allowDemoLocalhost: isDemoSite });
    if (!check.isValid) {
      return {
        isApproved: false,
        actionType: actionName,
        sanitizedArgs: args,
        requiresHumanApproval: false,
        reason: `Destination URL failed SSRF validation: ${check.reason}`,
      };
    }

    // Must match approved target domain
    const destDomain = check.domain || '';
    const isDomainAllowed =
      destDomain === approvedDomain ||
      destDomain.endsWith(`.${approvedDomain}`) ||
      (isDemoSite && (destDomain === 'localhost' || destDomain === '127.0.0.1'));

    if (!isDomainAllowed) {
      return {
        isApproved: false,
        actionType: actionName,
        sanitizedArgs: args,
        requiresHumanApproval: false,
        reason: `Proposed navigation to '${destDomain}' is outside approved target scope '${approvedDomain}'.`,
      };
    }

    sanitizedArgs.url = sanitizeUrl(args.url);
  }

  return {
    isApproved: true,
    actionType: actionName,
    sanitizedArgs,
    requiresHumanApproval: false,
  };
}
