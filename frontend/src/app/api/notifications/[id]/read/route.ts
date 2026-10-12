import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth-guard';
import { markNotificationReadInStore } from '@/lib/db';

// PATCH /api/notifications/[id]/read
export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const userId = getSessionUserId(request);
    const { id } = await props.params;

    const updated = await markNotificationReadInStore(id, userId);
    if (!updated) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ notification: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to mark as read';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
