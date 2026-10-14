import { NextResponse } from 'next/server';
import { invalidateSession } from '@/lib/auth.service';
import { getSessionUserId } from '@/lib/auth-guard';
import { updateUser, saveStoreToDisk } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const userId = getSessionUserId(request);
    if (userId) {
      await updateUser(userId, { status: 'OFFLINE', lastSeen: 'Just now' });
      saveStoreToDisk();
    }

    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await invalidateSession(token);
    }

    const cookieHeader = request.headers.get('cookie') || '';
    const matchToken = cookieHeader.match(/devconnect_token=([^;]+)/);
    if (matchToken && matchToken[1]) {
      await invalidateSession(decodeURIComponent(matchToken[1]));
    }

    const res = NextResponse.json({ success: true, message: 'Logged out successfully.' });
    res.cookies.set('devconnect_token', '', { path: '/', maxAge: 0 });
    res.cookies.set('devconnect_user_id', '', { path: '/', maxAge: 0 });
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Logout error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
