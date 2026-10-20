import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dpdp-assessment-platform-secure-jwt-secret-key-2026';
const TOKEN_EXPIRY = '7d';
export const COOKIE_NAME = 'dpdp_session';

export const ROLES = {
  USER: 'user',
  ORGANIZATION_OWNER: 'organization_owner',
  ASSESSMENT_REVIEWER: 'assessment_reviewer',
  PLATFORM_ADMINISTRATOR: 'platform_administrator'
};

export const ROLE_LABELS = {
  [ROLES.USER]: 'User',
  [ROLES.ORGANIZATION_OWNER]: 'Organization Owner',
  [ROLES.ASSESSMENT_REVIEWER]: 'Assessment Reviewer',
  [ROLES.PLATFORM_ADMINISTRATOR]: 'Platform Administrator'
};

/**
 * Hash plain text password using bcrypt
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }
  return bcrypt.hash(password, 10);
}

/**
 * Compare plain password against bcrypt hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * Sign JWT session token for authenticated user
 * @param {{ _id: any, email: string, role: string, organization?: any, name: string }} user
 * @returns {string}
 */
export function generateSessionToken(user) {
  const payload = {
    userId: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role || ROLES.USER,
    organizationId: user.organization ? String(user.organization) : null
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify JWT session token
 * @param {string} token
 * @returns {object | null}
 */
export function verifySessionToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Extract authenticated session from incoming request
 * Checks Cookies or Authorization header
 * @param {Request} request
 * @returns {object | null}
 */
export function getAuthSession(request) {
  try {
    // 1. Try reading cookie
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map((c) => {
          const [key, ...v] = c.split('=');
          return [key, decodeURIComponent(v.join('='))];
        })
      );
      if (cookies[COOKIE_NAME]) {
        const decoded = verifySessionToken(cookies[COOKIE_NAME]);
        if (decoded) return decoded;
      }
    }

    // 2. Try Authorization Bearer header
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = verifySessionToken(token);
      if (decoded) return decoded;
    }

    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Enforce authentication and role permissions on an API route.
 * Returns authenticated session or throws error response object.
 * 
 * @param {Request} request
 * @param {string[]} [allowedRoles]
 * @returns {{ session: object | null, errorResponse?: Response }}
 */
export function requireAuth(request, allowedRoles = null) {
  const session = getAuthSession(request);

  if (!session) {
    return {
      session: null,
      errorResponse: Response.json(
        { success: false, error: 'Authentication required to access this resource.' },
        { status: 401 }
      )
    };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(session.role)) {
      return {
        session,
        errorResponse: Response.json(
          {
            success: false,
            error: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`
          },
          { status: 403 }
        )
      };
    }
  }

  return { session, errorResponse: null };
}

/**
 * Checks if the authenticated user has authorization to access the specified organization.
 * - Platform Administrators and Assessment Reviewers can access any organization.
 * - Organization Owners and Users can only access their linked organization.
 * 
 * @param {object} authUser - Session user
 * @param {string} targetOrgId - Target organization ID to check
 * @returns {boolean}
 */
export function checkOrganizationAccess(authUser, targetOrgId) {
  if (!authUser) return false;

  // Platform admin has universal access
  if (authUser.role === ROLES.PLATFORM_ADMINISTRATOR) {
    return true;
  }

  // Assessment reviewer has read/audit access across assigned entities
  if (authUser.role === ROLES.ASSESSMENT_REVIEWER) {
    return true;
  }

  // Organization owner and user must belong to target organization
  if (authUser.organizationId && String(authUser.organizationId) === String(targetOrgId)) {
    return true;
  }

  return false;
}
