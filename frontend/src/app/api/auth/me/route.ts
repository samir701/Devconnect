import { NextResponse } from 'next/server';
import { getUserById, updateUser, saveStoreToDisk } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth-guard';

export async function GET(request: Request) {
  const userId = getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ user: null });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  const { passwordHash: _, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}

export async function PATCH(request: Request) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    // Do not allow updating passwordHash via this endpoint
    delete body.passwordHash;

    const updated = await updateUser(userId, body);
    if (updated) {
      saveStoreToDisk();
    }
    const { passwordHash: _, ...safeUser } = (updated || {}) as any;
    return NextResponse.json({ user: safeUser });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
