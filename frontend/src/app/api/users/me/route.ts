import { NextResponse } from 'next/server';
import { getUserById, updateUser } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-guard';

export async function GET(request: Request) {
  try {
    const userId = getSessionUserId(request);

    // Try Prisma DB first
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (dbUser) {
        return NextResponse.json({
          user: {
            ...dbUser,
            skills: dbUser.skills ? (dbUser.skills.startsWith('[') ? JSON.parse(dbUser.skills) : dbUser.skills.split(',').map((s) => s.trim())) : [],
            status: dbUser.status,
          },
        });
      }
    } catch {
      // Fallback to store
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = getSessionUserId(request);
    const body = await request.json();

    const allowedUpdates = ['bio', 'headline', 'skills', 'status', 'githubUrl', 'linkedinUrl', 'avatarUrl', 'name'];
    const updateData: Record<string, unknown> = {};

    for (const key of allowedUpdates) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }

    // Status enum validation
    if (body.status && !['AVAILABLE', 'AWAY', 'OFFLINE', 'ONLINE'].includes(body.status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be AVAILABLE, AWAY, or OFFLINE.' },
        { status: 400 }
      );
    }

    // Try Prisma update
    try {
      const prismaStatus = body.status === 'ONLINE' ? 'AVAILABLE' : body.status;
      const skillsString = Array.isArray(body.skills)
        ? JSON.stringify(body.skills)
        : typeof body.skills === 'string'
        ? body.skills
        : undefined;

      const updatedDbUser = await prisma.user.update({
        where: { id: userId },
        data: {
          bio: body.bio,
          headline: body.headline,
          githubUrl: body.githubUrl,
          linkedinUrl: body.linkedinUrl,
          avatarUrl: body.avatarUrl,
          name: body.name,
          ...(prismaStatus ? { status: prismaStatus as 'AVAILABLE' | 'AWAY' | 'OFFLINE' } : {}),
          ...(skillsString !== undefined ? { skills: skillsString } : {}),
        },
      });

      if (updatedDbUser) {
        // Also update store for cache consistency
        await updateUser(userId, body);
        return NextResponse.json({
          user: {
            ...updatedDbUser,
            skills: updatedDbUser.skills ? (updatedDbUser.skills.startsWith('[') ? JSON.parse(updatedDbUser.skills) : updatedDbUser.skills.split(',')) : [],
          },
        });
      }
    } catch {
      // Fallback to store
    }

    const updated = await updateUser(userId, body);
    if (!updated) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update profile';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
