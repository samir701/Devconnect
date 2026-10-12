import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth-guard';
import {
  getNotificationPreferencesFromStore,
  updateNotificationPreferencesInStore,
} from '@/lib/db';

// GET /api/notifications/preferences
export async function GET(request: Request) {
  try {
    const userId = getSessionUserId(request);
    const prefs = await getNotificationPreferencesFromStore(userId);
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch preferences';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/notifications/preferences
export async function PATCH(request: Request) {
  try {
    const userId = getSessionUserId(request);
    const body = await request.json();
    const allowed = [
      'emailOnTaskAssigned',
      'emailOnTaskCompleted',
      'emailOnBugAssigned',
      'emailOnMention',
      'inAppAll',
    ];
    const data: Record<string, boolean> = {};
    for (const key of allowed) {
      if (typeof body[key] === 'boolean') data[key] = body[key];
    }
    const prefs = await updateNotificationPreferencesInStore(userId, data);
    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update preferences';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
