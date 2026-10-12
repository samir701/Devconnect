import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth-guard';
import { getNotificationsFromStore } from '@/lib/db';

// GET /api/notifications?unread=true&priority=HIGH&page=1&limit=20
export async function GET(request: Request) {
  try {
    const userId = getSessionUserId(request);
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const priority = searchParams.get('priority') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20'));

    const result = await getNotificationsFromStore(userId, {
      unreadOnly,
      priority,
      page,
      limit,
    });

    return NextResponse.json({
      notifications: result.notifications,
      total: result.total,
      unreadCount: result.unreadCount,
      page,
      limit,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch notifications';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
