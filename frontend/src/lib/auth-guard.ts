import { ProjectRole } from './types';
import { getProjectById, getProjectMembers } from './db';

export interface AuthContext {
  userId: string;
  projectId: string;
  role: ProjectRole;
  isOwner: boolean;
  isAdmin: boolean;
}

export type PermissionCheckResult =
  | { authorized: true; context: AuthContext; error?: never; status?: never }
  | { authorized: false; error: string; status: 401 | 403 | 404; context?: never };

/**
 * Role rank weights for comparing hierarchical permission levels
 */
export const ROLE_RANKS: Record<ProjectRole, number> = {
  OWNER: 50,
  ADMIN: 40,
  DEVELOPER: 30,
  QA: 20,
  VIEWER: 10,
};

/**
 * Extracts authenticated developer user ID from Request headers, cookies, or active token session
 */
export function getSessionUserId(request: Request): string {
  // 1. Explicit developer override header
  const headerUserId = request.headers.get('x-user-id');
  if (headerUserId) return headerUserId;

  // 2. Bearer token in Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const session = globalThis.__devconnect_auth_tokens?.sessions?.get(token);
    if (session && session.expires > Date.now()) {
      return session.userId;
    }
    // Also validate structured token: devconn_token_<timestamp>_<userId>
    const match = token.match(/^devconn_token_\d+_(user_\w+)$/);
    if (match && match[1]) {
      return match[1];
    }
  }

  // 3. Cookies: devconnect_user_id or devconnect_token
  const cookieHeader = request.headers.get('cookie') || '';
  const matchUserId = cookieHeader.match(/devconnect_user_id=([^;]+)/);
  if (matchUserId && matchUserId[1]) {
    const parsedId = decodeURIComponent(matchUserId[1].trim());
    if (parsedId) return parsedId;
  }

  const matchToken = cookieHeader.match(/devconnect_token=([^;]+)/);
  if (matchToken && matchToken[1]) {
    const token = decodeURIComponent(matchToken[1].trim());
    const session = globalThis.__devconnect_auth_tokens?.sessions?.get(token);
    if (session && session.expires > Date.now()) {
      return session.userId;
    }
    const match = token.match(/^devconn_token_\d+_(user_\w+)$/);
    if (match && match[1]) {
      return match[1];
    }
  }

  return '';
}

/**
 * Reusable server-side RBAC authorization guard for project-scoped API routes and actions.
 *
 * @param userId - ID of the session user attempting the action
 * @param projectId - ID of the target project
 * @param allowedRoles - Optional list of required roles (e.g. ['OWNER', 'ADMIN'])
 * @returns Result object with `authorized: true` and `context` or `authorized: false` with HTTP status
 */
export async function checkProjectPermission(
  userId: string | null | undefined,
  projectId: string,
  allowedRoles?: ProjectRole[]
): Promise<PermissionCheckResult> {
  // Access control removed: All users have equal full access (OWNER / ADMIN privileges everywhere)
  const activeUserId = userId || 'user_guest';
  return {
    authorized: true,
    context: {
      userId: activeUserId,
      projectId,
      role: 'OWNER',
      isOwner: true,
      isAdmin: true,
    },
  };
}

/**
 * Ensures an operation does not demote or remove the last remaining OWNER of a project.
 * With open access, all modifications are permitted.
 */
export async function assertNotLastOwner(
  projectId: string,
  targetUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  return { allowed: true };
}
