import { NextResponse } from 'next/server';
import { invalidateSession } from '@/lib/auth.service';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await invalidateSession(token);
    }
    return NextResponse.json({ success: true, message: 'Logged out successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Logout error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
