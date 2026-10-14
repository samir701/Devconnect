import { NextResponse } from 'next/server';
import {
  getProjectMembers,
  updateProjectMemberRole,
  removeProjectMember,
  getProjectById,
} from '@/lib/db';
import { prisma } from '@/lib/prisma';
import {
  checkProjectPermission,
  getSessionUserId,
  assertNotLastOwner,
} from '@/lib/auth-guard';
import { emitRealtimeEvent } from '@/lib/activity';
import { ProjectRole } from '@/lib/types';
import { z } from 'zod';

const UpdateRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'DEVELOPER', 'QA', 'VIEWER']),
});

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: projectId, memberId } = await props.params;
    const currentUserId = getSessionUserId(request);

    // 1. RBAC Guard: Only OWNER or ADMIN can change member roles
    const guard = await checkProjectPermission(currentUserId, projectId, ['OWNER', 'ADMIN']);
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const body = await request.json();
    const validation = UpdateRoleSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Valid role is required (OWNER, ADMIN, DEVELOPER, QA, VIEWER)' },
        { status: 400 }
      );
    }

    const { role: newRole } = validation.data;

    // 2. Fetch current member record
    const members = await getProjectMembers(projectId);
    const targetMember = members.find((m) => m.id === memberId || m.userId === memberId);

    if (!targetMember) {
      return NextResponse.json({ error: 'Project member not found' }, { status: 404 });
    }


    // 4. Sole Owner Protection: Cannot demote the only OWNER
    if (targetMember.role === 'OWNER' && newRole !== 'OWNER') {
      const ownerCheck = await assertNotLastOwner(projectId, targetMember.userId);
      if (!ownerCheck.allowed) {
        return NextResponse.json({ error: ownerCheck.reason }, { status: 400 });
      }
    }

    // 5. Update in Prisma
    try {
      const updated = await prisma.projectMember.update({
        where: {
          id: targetMember.id,
        },
        data: {
          role: newRole as ProjectRole,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, headline: true, status: true },
          },
        },
      });

      await updateProjectMemberRole(projectId, targetMember.id, newRole);
      return NextResponse.json({ member: updated });
    } catch {
      // Fallback to store
      const updated = await updateProjectMemberRole(projectId, targetMember.id, newRole);
      return NextResponse.json({ member: updated });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update member role';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id: projectId, memberId } = await props.params;
    const currentUserId = getSessionUserId(request);

    // Fetch target member
    const members = await getProjectMembers(projectId);
    const targetMember = members.find((m) => m.id === memberId || m.userId === memberId);

    if (!targetMember) {
      return NextResponse.json({ error: 'Project member not found' }, { status: 404 });
    }

    const isSelfLeaving = targetMember.userId === currentUserId;

    // RBAC: Must be OWNER/ADMIN or leaving themselves
    if (!isSelfLeaving) {
      const guard = await checkProjectPermission(currentUserId, projectId, ['OWNER', 'ADMIN']);
      if (!guard.authorized) {
        return NextResponse.json({ error: guard.error }, { status: guard.status });
      }

    }

    // Sole Owner Protection
    if (targetMember.role === 'OWNER') {
      const ownerCheck = await assertNotLastOwner(projectId, targetMember.userId);
      if (!ownerCheck.allowed) {
        return NextResponse.json({ error: ownerCheck.reason }, { status: 400 });
      }
    }

    // Delete in Prisma
    try {
      await prisma.projectMember.delete({
        where: { id: targetMember.id },
      });
    } catch {
      // Ignore Prisma errors if running on in-memory store
    }

    const removed = await removeProjectMember(projectId, targetMember.id);
    if (!removed) {
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    emitRealtimeEvent('member_removed', {
      projectId,
      memberId: targetMember.id,
      userId: targetMember.userId,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: isSelfLeaving ? 'You have left the project' : 'Member removed from project',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to remove member';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
