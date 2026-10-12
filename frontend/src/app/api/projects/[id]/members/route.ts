import { NextResponse } from 'next/server';
import {
  getProjectById,
  getProjectMembers,
  addProjectMember,
  getUserById,
  getUserByEmail,
  getUsers,
} from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { checkProjectPermission, getSessionUserId } from '@/lib/auth-guard';
import { ProjectRole } from '@/lib/types';
import { z } from 'zod';

const AddMemberSchema = z.object({
  email: z.string().email().optional(),
  userId: z.string().optional(),
  role: z.enum(['OWNER', 'ADMIN', 'DEVELOPER', 'QA', 'VIEWER']).default('DEVELOPER'),
});

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const userId = getSessionUserId(request);

    // Any member can view the member list
    const guard = await checkProjectPermission(userId, id);
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    try {
      const dbMembers = await prisma.projectMember.findMany({
        where: { projectId: id },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, headline: true, status: true },
          },
        },
      });

      if (dbMembers && dbMembers.length > 0) {
        return NextResponse.json({ members: dbMembers });
      }
    } catch {
      // Fallback to store
    }

    const members = await getProjectMembers(id);
    return NextResponse.json({ members });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await props.params;
    const currentUserId = getSessionUserId(request);

    // RBAC: Only OWNER or ADMIN can invite/add project members
    const guard = await checkProjectPermission(currentUserId, projectId, ['OWNER', 'ADMIN']);
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const body = await request.json();
    const validation = AddMemberSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid member data' },
        { status: 400 }
      );
    }

    const { email, userId, role } = validation.data;
    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Either email or userId is required to add a member' },
        { status: 400 }
      );
    }

    // Resolve target user
    let targetUser = null;
    if (userId) {
      targetUser = await getUserById(userId);
    } else if (email) {
      targetUser = await getUserByEmail(email);
      if (!targetUser) {
        const allUsers = await getUsers();
        targetUser = allUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
      }
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: `No registered developer account found for ${email || userId}` },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMembers = await getProjectMembers(projectId);
    const existing = existingMembers.find((m) => m.userId === targetUser?.id);
    if (existing) {
      return NextResponse.json(
        { error: `${targetUser.name} is already a member of this project (${existing.role})` },
        { status: 409 }
      );
    }

    // Try Prisma DB insert
    try {
      const createdMember = await prisma.projectMember.create({
        data: {
          projectId,
          userId: targetUser.id,
          role: role as ProjectRole,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarUrl: true, headline: true, status: true },
          },
        },
      });

      // Sync store
      await addProjectMember(projectId, targetUser.id, role as ProjectRole);

      return NextResponse.json({ member: createdMember }, { status: 201 });
    } catch {
      // Store fallback
      const member = await addProjectMember(projectId, targetUser.id, role as ProjectRole);
      return NextResponse.json({ member }, { status: 201 });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to add project member';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
