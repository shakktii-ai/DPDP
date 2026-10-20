import { URL } from 'url';
import crypto from 'crypto';

/**
 * Validates a target URL against SSRF (Server-Side Request Forgery) vulnerabilities.
 * Blocks private IP ranges, loopbacks, link-local, cloud metadata services, and invalid schemes.
 * 
 * @param {string} inputUrl - The URL to validate
 * @returns {{ isValid: boolean, normalizedUrl?: string, domain?: string, reason?: string }}
 */
export function validateTargetUrl(inputUrl, options = {}) {
  const { allowDemoLocalhost = false } = options;

  if (!inputUrl || typeof inputUrl !== 'string') {
    return { isValid: false, reason: 'URL string is required.' };
  }

  const trimmed = inputUrl.trim();

  // Basic format check
  if (!/^https?:\/\//i.test(trimmed)) {
    return {
      isValid: false,
      reason: 'URL must begin with http:// or https:// scheme.'
    };
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (err) {
    return { isValid: false, reason: 'Malformed URL structure.' };
  }

  // Scheme must be strictly http or https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { isValid: false, reason: 'Only HTTP and HTTPS protocols are allowed.' };
  }

  // Reject embedded credentials (e.g. http://user:pass@example.com)
  if (parsed.username || parsed.password) {
    return { isValid: false, reason: 'Embedded authentication credentials are not permitted.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // If local demo testing is explicitly authorized for this target
  const isLocalDemo = allowDemoLocalhost && (hostname === 'localhost' || hostname === '127.0.0.1');

  // Disallow localhost and common local hostnames unless authorized demo
  if (!isLocalDemo) {
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.corp') ||
      hostname.endsWith('.home') ||
      hostname.endsWith('.lan')
    ) {
      return {
        isValid: false,
        reason: 'Local and internal hostnames cannot be targeted for external assessment.'
      };
    }
  }

  // Check IPv4 addresses
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostname.match(ipv4Regex);

  if (match) {
    const octets = match.slice(1, 5).map(Number);

    // Range checks
    for (const octet of octets) {
      if (octet < 0 || octet > 255) {
        return { isValid: false, reason: 'Invalid IPv4 octet.' };
      }
    }

    const [a, b, c, d] = octets;

    // Loopback (127.0.0.0/8) - unless authorized demo
    if (a === 127 && !isLocalDemo) {
      return { isValid: false, reason: 'Loopback IP addresses (127.0.0.0/8) are blocked.' };
    }

    // 0.0.0.0/8
    if (a === 0) {
      return { isValid: false, reason: 'Zero-network addresses (0.0.0.0/8) are blocked.' };
    }

    // Private Class A (10.0.0.0/8)
    if (a === 10) {
      return { isValid: false, reason: 'Private Class A address ranges (10.0.0.0/8) are blocked.' };
    }

    // Private Class B (172.16.0.0/12 -> 172.16.0.0 to 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) {
      return { isValid: false, reason: 'Private Class B address ranges (172.16.0.0/12) are blocked.' };
    }

    // Private Class C (192.168.0.0/16)
    if (a === 192 && b === 168) {
      return { isValid: false, reason: 'Private Class C address ranges (192.168.0.0/16) are blocked.' };
    }

    // Link-local & Cloud Metadata (169.254.0.0/16 including 169.254.169.254)
    if (a === 169 && b === 254) {
      return {
        isValid: false,
        reason: 'Link-local & cloud metadata endpoints (169.254.0.0/16) are strictly blocked.'
      };
    }

    // Carrier-Grade NAT (100.64.0.0/10)
    if (a === 100 && b >= 64 && b <= 127) {
      return { isValid: false, reason: 'Carrier-Grade NAT addresses are blocked.' };
    }

    // Multicast (224.0.0.0/4) and Broadcast (255.255.255.255)
    if (a >= 224) {
      return { isValid: false, reason: 'Multicast and reserved addresses are blocked.' };
    }
  }

  // IPv6 check (blocked for localhost and link-local)
  if (hostname.startsWith('[') || hostname.includes(':')) {
    const rawIp6 = hostname.replace(/^\[|\]$/g, '');
    if (
      rawIp6 === '::1' ||
      rawIp6 === '::' ||
      rawIp6.startsWith('fe80:') ||
      rawIp6.startsWith('fc00:') ||
      rawIp6.startsWith('fd00:')
    ) {
      return { isValid: false, reason: 'IPv6 local and private addresses are blocked.' };
    }
  }

  // Disallow common cloud metadata domain tricks
  if (
    hostname.includes('metadata.google.internal') ||
    hostname.includes('169.254.169.254')
  ) {
    return { isValid: false, reason: 'Cloud metadata service access is prohibited.' };
  }

  // Require at least one dot in domain name unless testing on valid top-level domain or local demo
  if (!isLocalDemo && !hostname.includes('.')) {
    return { isValid: false, reason: 'Domain name must contain a valid top-level domain (e.g. .in, .com).' };
  }

  return {
    isValid: true,
    normalizedUrl: parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname),
    domain: hostname
  };
}

/**
 * Validates document upload constraints (max 10MB, safe mime types, no executable files).
 * @param {{ name: string, size: number, type: string }} fileMetadata
 * @returns {{ isValid: boolean, reason?: string }}
 */
export function validateDocumentUpload(fileMetadata) {
  if (!fileMetadata) {
    return { isValid: false, reason: 'Document metadata is required.' };
  }

  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  if (fileMetadata.size > MAX_SIZE_BYTES) {
    return {
      isValid: false,
      reason: `File size exceeds the 10MB limit (size: ${(fileMetadata.size / (1024 * 1024)).toFixed(2)} MB).`
    };
  }

  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/html',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/json'
  ];

  const BLOCKED_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.sh', '.bin', '.dll', '.vbs', '.js', '.jar',
    '.ps1', '.php', '.phtml', '.py', '.msi', '.com', '.scr', '.hta'
  ];

  const lowerName = (fileMetadata.name || '').toLowerCase();
  for (const ext of BLOCKED_EXTENSIONS) {
    if (lowerName.endsWith(ext)) {
      return {
        isValid: false,
        reason: `Executable or script files (${ext}) are prohibited for security reasons.`
      };
    }
  }

  if (fileMetadata.type && !ALLOWED_MIME_TYPES.includes(fileMetadata.type)) {
    // If MIME type isn't standard, check safe file extension
    const hasSafeExtension = ['.pdf', '.txt', '.md', '.docx', '.doc', '.html', '.htm', '.json'].some(
      (ext) => lowerName.endsWith(ext)
    );
    if (!hasSafeExtension) {
      return {
        isValid: false,
        reason: 'Unsupported document format. Allowed formats: PDF, TXT, Markdown, Word (DOCX), HTML, JSON.'
      };
    }
  }

  return { isValid: true };
}

/**
 * Validates a login URL against the approved target website.
 * Allows relative paths (e.g. /login) or absolute URLs matching approved domain.
 */
export function validateLoginUrl(loginUrl, baseWebsiteUrl, options = {}) {
  if (!loginUrl || typeof loginUrl !== 'string') {
    return { isValid: false, reason: 'Login URL is required.' };
  }

  const trimmed = loginUrl.trim();

  // If relative path (e.g. /login or /account/signin)
  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) {
      return { isValid: false, reason: 'Protocol-relative URLs are not permitted.' };
    }
    return {
      isValid: true,
      normalizedUrl: trimmed,
      isRelative: true,
    };
  }

  // If absolute URL
  const baseCheck = validateTargetUrl(trimmed, options);
  if (!baseCheck.isValid) {
    return { isValid: false, reason: baseCheck.reason };
  }

  // If baseWebsiteUrl provided, ensure the login domain matches the base website domain
  if (baseWebsiteUrl) {
    try {
      const baseHost = new URL(baseWebsiteUrl).hostname.toLowerCase();
      const loginHost = new URL(trimmed).hostname.toLowerCase();

      // Check if same domain or subdomain
      const isAllowedHost =
        loginHost === baseHost ||
        loginHost.endsWith(`.${baseHost}`) ||
        baseHost.endsWith(`.${loginHost}`);

      if (!isAllowedHost) {
        return {
          isValid: false,
          reason: `Login URL domain (${loginHost}) does not belong to the approved website (${baseHost}).`,
        };
      }
    } catch {
      return { isValid: false, reason: 'Invalid target website URL reference.' };
    }
  }

  return {
    isValid: true,
    normalizedUrl: baseCheck.normalizedUrl,
    domain: baseCheck.domain,
    isRelative: false,
  };
}

/**
 * Encrypts a sensitive credential at rest using AES-256-GCM.
 */
export function encryptCredential(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return null;
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'dpdp-vault-assessment-key-32b-secret!';
  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a sensitive credential encrypted with encryptCredential.
 */
export function decryptCredential(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') return null;
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, encryptedHex] = parts;
    const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'dpdp-vault-assessment-key-32b-secret!';
    const key = crypto.createHash('sha256').update(secret).digest();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt credential:', err.message);
    return null;
  }
}

