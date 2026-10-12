import { NextResponse } from 'next/server';
import { getUserById, updateUser } from '@/lib/db';

export async function GET() {
  // Return current logged in user (defaults to Samir Brahma)
  const user = await getUserById('user_samir');
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  return NextResponse.json({ user });
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const updated = await updateUser('user_samir', body);
    return NextResponse.json({ user: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
