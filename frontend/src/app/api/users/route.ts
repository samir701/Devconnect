import { NextResponse } from 'next/server';
import { getUsers } from '@/lib/db';

export async function GET() {
  try {
    const users = await getUsers();
    const safeUsers = users.map((u) => {
      const { passwordHash: _, ...safe } = u;
      return safe;
    });
    return NextResponse.json({ users: safeUsers });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to fetch users';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
