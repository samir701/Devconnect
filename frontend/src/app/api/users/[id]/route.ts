import { NextResponse } from 'next/server';
import { getUserById } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    // Try Prisma DB first
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id },
        include: {
          memberships: {
            include: {
              project: {
                select: { id: true, name: true, status: true },
              },
            },
          },
        },
      });

      if (dbUser) {
        return NextResponse.json({
          user: {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            avatarUrl: dbUser.avatarUrl,
            headline: dbUser.headline,
            bio: dbUser.bio,
            skills: dbUser.skills
              ? dbUser.skills.startsWith('[')
                ? JSON.parse(dbUser.skills)
                : dbUser.skills.split(',').map((s) => s.trim())
              : [],
            githubUrl: dbUser.githubUrl,
            linkedinUrl: dbUser.linkedinUrl,
            status: dbUser.status,
            lastSeen: dbUser.lastSeen,
            createdAt: dbUser.createdAt,
            projects: dbUser.memberships.map((m) => ({
              projectId: m.projectId,
              projectName: m.project.name,
              role: m.role,
              joinedAt: m.joinedAt,
            })),
          },
        });
      }
    } catch {
      // Fallback to store
    }

    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'Developer not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
