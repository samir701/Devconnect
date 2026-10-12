/**
 * Phase 6 – Notification Helper
 * Persists Notification records to TiDB and emits `new_notification`
 * to the recipient's personal socket room via the backend gateway.
 */

import { prisma } from '@/lib/prisma';
import {
  createNotificationInStore,
  getNotificationPreferencesFromStore,
} from '@/lib/db';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | 'MENTION'
  | 'TASK_ASSIGNED'
  | 'TASK_COMPLETED'
  | 'BUG_ASSIGNED'
  | 'BUG_RESOLVED'
  | 'DIRECT_MESSAGE'
  | 'REPLY';

type NotificationPriority = 'HIGH' | 'NORMAL' | 'LOW';

interface CreateNotificationParams {
  recipientId: string;
  senderId?: string;
  projectId?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  entityId?: string;
  entityType?: 'TASK' | 'BUG' | 'MESSAGE';
}

// ─── Socket Gateway Emitter ───────────────────────────────────────────────────

async function emitToSocket(event: string, payload: Record<string, unknown>): Promise<void> {
  const socketUrl =
    process.env.NEXT_PUBLIC_SOCKET_URL ||
    `http://localhost:${process.env.SOCKET_PORT || 3001}`;

  try {
    await fetch(`${socketUrl}/events/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Non-critical – socket might not be running in SSR/test environments
  }
}

// ─── Core Creator ─────────────────────────────────────────────────────────────

export async function createNotification(
  params: CreateNotificationParams
): Promise<{ id: string } | null> {
  const {
    recipientId,
    senderId,
    projectId,
    type,
    priority = 'NORMAL',
    title,
    message,
    entityId,
    entityType,
  } = params;

  // Skip if recipient is the same as sender (no self-notifications)
  if (senderId && senderId === recipientId) return null;

  try {
    let createdId = '';
    let createdAtIso = new Date().toISOString();

    // 1. Try Prisma if available
    if ((prisma as any)?.notification) {
      try {
        const record = await (prisma as any).notification.create({
          data: {
            recipientId,
            senderId: senderId || null,
            projectId: projectId || null,
            type,
            priority,
            title,
            message,
            entityId: entityId || null,
            entityType: entityType || null,
            read: false,
          },
        });
        createdId = record.id;
        createdAtIso = record.createdAt.toISOString();
      } catch (prismaErr) {
        console.warn('[Notifications] Prisma create failed, using store:', prismaErr);
      }
    }

    // 2. Persist to store as well
    const storeRecord = await createNotificationInStore({
      id: createdId || undefined,
      recipientId,
      senderId,
      projectId,
      type,
      priority,
      title,
      message,
      entityId,
      entityType,
    });
    if (!createdId) {
      createdId = storeRecord.id;
      createdAtIso = storeRecord.createdAt;
    }

    // 3. Emit realtime notification to recipient's personal channel
    await emitToSocket('new_notification', {
      userId: recipientId,
      notification: {
        id: createdId,
        type,
        priority,
        title,
        message,
        entityId,
        entityType,
        senderId,
        projectId,
        read: false,
        createdAt: createdAtIso,
      },
    });

    return { id: createdId };
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err);
    return null;
  }
}

// ─── Preference Guard ─────────────────────────────────────────────────────────

export async function getUserNotificationPreferences(userId: string) {
  return getNotificationPreferencesFromStore(userId);
}
