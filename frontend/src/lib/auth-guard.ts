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
 * Extracts authenticated developer user ID from Request headers or active token session
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
  }

  // 3. Fallback to default authenticated session (Samir Brahma)
  return 'user_samir';
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
  if (!userId) {
    return {
      authorized: false,
      error: 'Unauthorized: Authentication required',
      status: 401,
    };
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return {
      authorized: false,
      error: 'Project not found',
      status: 404,
    };
  }

  // Fetch project members
  const members = await getProjectMembers(projectId);
  const member = members.find((m) => m.userId === userId);

  // If user is marked as project owner on the project record, grant OWNER role
  const isDirectOwner = project.ownerId === userId;
  const userRole: ProjectRole | null = isDirectOwner ? 'OWNER' : (member?.role ?? null);

  if (!userRole) {
    return {
      authorized: false,
      error: 'Forbidden: You are not a member of this project',
      status: 403,
    };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(userRole)) {
      return {
        authorized: false,
        error: `Forbidden: This action requires one of [${allowedRoles.join(', ')}] role (your role is ${userRole})`,
        status: 403,
      };
    }
  }

  return {
    authorized: true,
    context: {
      userId,
      projectId,
      role: userRole,
      isOwner: userRole === 'OWNER',
      isAdmin: userRole === 'OWNER' || userRole === 'ADMIN',
    },
  };
}

/**
 * Ensures an operation does not demote or remove the last remaining OWNER of a project.
 */
export async function assertNotLastOwner(
  projectId: string,
  targetUserId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const members = await getProjectMembers(projectId);
  const owners = members.filter((m) => m.role === 'OWNER');
  
  if (owners.length <= 1 && owners.some((o) => o.userId === targetUserId)) {
    return {
      allowed: false,
      reason: 'Cannot demote or remove the sole Project Owner. Transfer ownership or assign another Owner first.',
    };
  }

  return { allowed: true };
}
