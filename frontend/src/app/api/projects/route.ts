import { NextResponse } from 'next/server';
import { getProjectsForUser, createProject, getProjects, isDatabaseConfigured } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-guard';
import { emitRealtimeEvent } from '@/lib/activity';
import { z } from 'zod';

const CreateProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters').max(100),
  description: z.string().max(1000).optional().default(''),
  githubRepo: z.string().max(255).optional().default(''),
  maxMembers: z.coerce.number().int().min(1, 'Max members must be at least 1').max(500, 'Max members cannot exceed 500').optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const userId = getSessionUserId(request);

    // Try Prisma DB query only when database is configured
    if (isDatabaseConfigured) {
      try {
        const dbProjects = await prisma.project.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true, headline: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (dbProjects && dbProjects.length > 0) {
        const formatted = dbProjects.map((p) => ({
          ...p,
          channels: p.channels ? JSON.parse(p.channels) : ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
        }));
        return NextResponse.json({ projects: formatted });
      }
    } catch {
      // Fallback to store
    }
    }

    const projects = await getProjectsForUser(userId);
    // If user has no scoped projects yet, return active projects
    const result = projects.length > 0 ? projects : await getProjects();
    return NextResponse.json({ projects: result });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch projects';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = getSessionUserId(request);
    const body = await request.json();

    const validation = CreateProjectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input data' },
        { status: 400 }
      );
    }

    const { name, description, githubRepo, maxMembers } = validation.data;

    // Execute atomic transaction in Prisma if database configured
    if (isDatabaseConfigured) {
      try {
        const project = await prisma.$transaction(async (tx) => {
          const created = await tx.project.create({
            data: {
              name,
              description,
              ownerId: userId,
              githubRepo: githubRepo || null,
              status: 'ACTIVE',
              channels: JSON.stringify(['general', 'development', 'bugs', 'tasks', 'files', 'activity']),
            },
          });

          await tx.projectMember.create({
            data: {
              projectId: created.id,
              userId,
              role: 'OWNER',
            },
          });

          return created;
        });

        // Synchronize in-memory store for instant UI reactivity
        const storeProject = await createProject({
          id: project.id,
          name,
          description,
          ownerId: userId,
          githubRepo,
          status: 'ACTIVE',
          channels: ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
          maxMembers: maxMembers || undefined,
        });

        const formattedProject = {
          ...project,
          id: project.id || storeProject.id,
          channels: ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
          maxMembers: maxMembers || undefined,
        };

        emitRealtimeEvent('project_created', { project: formattedProject }).catch(() => {});

        return NextResponse.json(
          {
            project: formattedProject,
          },
          { status: 201 }
        );
      } catch {}
    }

    // Fallback to atomic in-memory creation
    const project = await createProject({
      name,
      description,
      ownerId: userId,
      githubRepo,
      status: 'ACTIVE',
      channels: ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
      maxMembers: maxMembers || undefined,
    });

    emitRealtimeEvent('project_created', { project }).catch(() => {});

    return NextResponse.json({ project }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create project';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
