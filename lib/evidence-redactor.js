/**
 * Redacts sensitive and personally identifiable information (PII)
 * before persisting evidence or logs in MongoDB.
 */

const SENSITIVE_PATTERNS = [
  // Passwords, tokens, keys in URL or key-value pairs
  { regex: /(password|passwd|pwd|secret|api_key|token|auth_token|bearer)\s*[:=]\s*["']?([^"'&\s]+)["']?/gi, replacement: '$1=[REDACTED]' },
  // Credit / Debit card numbers (13-16 digits with spaces/hyphens) - match before Aadhaar (12 digits)
  { regex: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, replacement: '[REDACTED_CARD]' },
  // Aadhaar numbers (12 digits, optional spaces/hyphens)
  { regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '[REDACTED_AADHAAR]' },
  // Indian PAN (5 uppercase letters, 4 numbers, 1 letter)
  { regex: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g, replacement: '[REDACTED_PAN]' },
  // OTP codes (4 to 8 digit standalone numbers following OTP/code)
  { regex: /\b(otp|code|verification)\s*[:=]?\s*\b\d{4,8}\b/gi, replacement: '$1=[REDACTED_OTP]' },
  // JWT tokens
  { regex: /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, replacement: '[REDACTED_JWT]' },
  // Email addresses (preserve domain if helpful, or mask local part)
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, replacement: (match) => {
    // If it's a sample/example email, keep it readable
    if (match.endsWith('@example.com') || match.endsWith('.sample')) return match;
    const [local, domain] = match.split('@');
    return `${local.slice(0, 2)}***@${domain}`;
  }},
  // Phone numbers (Indian 10-digit mobile or international format)
  { regex: /(?:\+91[\s-]?)?[6789]\d{9}\b/g, replacement: '[REDACTED_PHONE]' },
];

/**
 * Redacts sensitive text content.
 * @param {string} text
 * @returns {string}
 */
export function redactSensitiveData(text) {
  if (!text || typeof text !== 'string') return text;
  let redacted = text;
  for (const { regex, replacement } of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(regex, replacement);
  }
  return redacted;
}

/**
 * Sanitizes a URL by removing query parameters that might contain credentials or session tokens.
 * @param {string} urlString
 * @returns {string}
 */
export function sanitizeUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return '';
  try {
    const parsed = new URL(urlString);
    const SENSITIVE_QUERY_KEYS = ['token', 'access_token', 'password', 'pwd', 'secret', 'otp', 'code', 'auth', 'key', 'apikey'];
    for (const key of parsed.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEYS.includes(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return urlString.replace(/[?&](?:token|password|secret|key|otp)=[^&]*/gi, '');
  }
}
