import { NextResponse } from 'next/server';
import { getProjectsForUser, createProject, getProjects } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-guard';
import { z } from 'zod';

const CreateProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters').max(100),
  description: z.string().max(1000).optional().default(''),
  githubRepo: z.string().max(255).optional().default(''),
});

export async function GET(request: Request) {
  try {
    const userId = getSessionUserId(request);

    // Try Prisma DB query
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

    const { name, description, githubRepo } = validation.data;

    // Execute atomic transaction in Prisma
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
      });

      return NextResponse.json(
        {
          project: {
            ...project,
            id: project.id || storeProject.id,
            channels: ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
          },
        },
        { status: 201 }
      );
    } catch {
      // Fallback to atomic in-memory creation
      const project = await createProject({
        name,
        description,
        ownerId: userId,
        githubRepo,
        status: 'ACTIVE',
        channels: ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
      });

      return NextResponse.json({ project }, { status: 201 });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create project';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
