import { NextResponse } from 'next/server';
import {
  getProjectById,
  getProjectMembers,
  getTasks,
  getBugs,
  getAttachments,
  getActivity,
  updateProject,
  archiveProject,
} from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { checkProjectPermission, getSessionUserId } from '@/lib/auth-guard';
import { z } from 'zod';

const UpdateProjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(1000).optional(),
  githubRepo: z.string().max(255).optional(),
});

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const userId = getSessionUserId(request);

    // Try Prisma DB first
    try {
      const dbProject = await prisma.project.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true, headline: true, status: true },
              },
            },
          },
          tasks: true,
          bugs: true,
          attachments: true,
        },
      });

      if (dbProject) {
        const userMember = dbProject.members.find((m) => m.userId === userId);
        const userRole = dbProject.ownerId === userId ? 'OWNER' : userMember?.role || null;

        return NextResponse.json({
          project: {
            ...dbProject,
            channels: dbProject.channels ? JSON.parse(dbProject.channels) : ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
          },
          members: dbProject.members,
          tasks: dbProject.tasks,
          bugs: dbProject.bugs,
          attachments: dbProject.attachments,
          userRole,
        });
      }
    } catch {
      // Fallback to store
    }

    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const [members, tasks, bugs, attachments, activity] = await Promise.all([
      getProjectMembers(id),
      getTasks(id),
      getBugs(id),
      getAttachments(id),
      getActivity(id),
    ]);

    const userMember = members.find((m) => m.userId === userId);
    const userRole = project.ownerId === userId ? 'OWNER' : userMember?.role || null;

    return NextResponse.json({
      project,
      members,
      tasks,
      bugs,
      attachments,
      activity,
      userRole,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const userId = getSessionUserId(request);

    // 1. RBAC Guard: Only OWNER or ADMIN can modify project details
    const guard = await checkProjectPermission(userId, id, ['OWNER', 'ADMIN']);
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const body = await request.json();
    const validation = UpdateProjectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input data' },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Try Prisma update
    try {
      const updated = await prisma.project.update({
        where: { id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.githubRepo !== undefined ? { githubRepo: data.githubRepo } : {}),
        },
      });

      await updateProject(id, data);

      return NextResponse.json({
        project: {
          ...updated,
          channels: updated.channels ? JSON.parse(updated.channels) : ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
        },
      });
    } catch {
      // Fallback to store
      const updated = await updateProject(id, data);
      return NextResponse.json({ project: updated });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update project';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const userId = getSessionUserId(request);

    // 1. RBAC Guard: Restricted to OWNER only
    const guard = await checkProjectPermission(userId, id, ['OWNER']);
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    // Try Prisma soft-delete / archive
    try {
      await prisma.project.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
    } catch {
      // Ignore Prisma errors if running on store
    }

    const archived = await archiveProject(id);
    return NextResponse.json({
      message: 'Project archived successfully',
      project: archived,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to archive project';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
