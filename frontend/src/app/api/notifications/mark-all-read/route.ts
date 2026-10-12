import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth-guard';
import { markAllNotificationsReadInStore } from '@/lib/db';

// POST /api/notifications/mark-all-read
export async function POST(request: Request) {
  try {
    const userId = getSessionUserId(request);
    const count = await markAllNotificationsReadInStore(userId);
    return NextResponse.json({ success: true, updated: count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to mark all as read';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
