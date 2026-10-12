import { prisma } from './prisma';
import { ActivityLog, ActionType, User } from './types';

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

export interface LogActivityParams {
  projectId: string;
  userId: string;
  actionType: ActionType;
  entityId?: string;
  entityType?: 'TASK' | 'BUG' | 'FILE' | 'MESSAGE' | 'PROJECT' | string;
  metadata?: Record<string, any> | string;
  title?: string;
  details?: string;
}

/**
 * Emits an event to the background Socket.IO gateway server via HTTP POST
 */
export async function emitRealtimeEvent(event: string, payload: Record<string, any>) {
  try {
    const res = await fetch(`${SOCKET_SERVER_URL}/api/events/${event}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    // Non-blocking in case realtime server is not listening
    return false;
  }
}

/**
 * Generates human-friendly summary for an activity item
 */
export function formatActivitySummary(
  actionType: string,
  meta?: Record<string, any> | null,
  customTitle?: string,
  customDetails?: string
): { title: string; details: string } {
  if (customTitle) {
    return { title: customTitle, details: customDetails || '' };
  }

  const titleText = meta?.title || meta?.fileName || 'Item';
  switch (actionType) {
    case 'TASK_CREATED':
      return {
        title: `Task created: ${titleText}`,
        details: meta?.description || (meta?.priority ? `Priority: ${meta.priority}` : ''),
      };
    case 'TASK_UPDATED':
      return {
        title: `Task updated: ${titleText}`,
        details: meta?.status ? `Status changed to ${meta.status}` : (meta?.details || ''),
      };
    case 'BUG_REPORTED':
      return {
        title: `Bug reported: ${titleText}`,
        details: meta?.endpoint ? `Endpoint: ${meta.endpoint}` : (meta?.description || ''),
      };
    case 'BUG_STATUS_CHANGED':
      return {
        title: `Bug moved to ${meta?.status || 'UPDATED'}: ${titleText}`,
        details: meta?.previousStatus ? `Previous: ${meta.previousStatus}` : '',
      };
    case 'FILE_UPLOADED':
      return {
        title: `File uploaded: ${titleText}`,
        details: meta?.fileSize ? `${(meta.fileSize / 1024).toFixed(1)} KB stored in Backblaze B2` : '',
      };
    case 'MEMBER_JOINED':
      return {
        title: `New member joined project`,
        details: meta?.role ? `Assigned role: ${meta.role}` : '',
      };
    case 'MESSAGE_CONVERTED':
      return {
        title: `Message converted to ${meta?.targetType || 'Item'}`,
        details: titleText,
      };
    case 'CODE_SHARED':
      return {
        title: `Code snippet shared: ${meta?.language || 'code'}`,
        details: meta?.filename || '',
      };
    default:
      return {
        title: `${actionType.replace(/_/g, ' ').toLowerCase()}: ${titleText}`,
        details: customDetails || '',
      };
  }
}

/**
 * Creates an immutable ActivityLog entry in TiDB Cloud with fallback to in-memory store
 * and automatically notifies active WebSocket rooms.
 */
export async function logActivity(params: LogActivityParams): Promise<ActivityLog> {
  const { projectId, userId, actionType, entityId, entityType, metadata, title, details } = params;

  const parsedMeta: Record<string, any> | null =
    typeof metadata === 'string'
      ? (() => {
          try {
            return JSON.parse(metadata);
          } catch {
            return { raw: metadata };
          }
        })()
      : (metadata || null);

  const metaString = parsedMeta ? JSON.stringify(parsedMeta) : null;
  const summary = formatActivitySummary(actionType, parsedMeta, title, details);

  let actorUser: User | null = null;
  try {
    actorUser = globalThis.__devconnect_store?.users.get(userId) || null;
  } catch {}

  let createdLog: ActivityLog;

  try {
    const dbRecord = await prisma.activityLog.create({
      data: {
        projectId,
        userId,
        actionType,
        entityId: entityId || null,
        entityType: entityType || null,
        metadata: metaString,
      },
      include: {
        user: true,
      },
    });

    createdLog = {
      id: dbRecord.id,
      projectId: dbRecord.projectId,
      userId: dbRecord.userId,
      actionType: dbRecord.actionType,
      entityId: dbRecord.entityId || undefined,
      entityType: dbRecord.entityType || undefined,
      metadata: dbRecord.metadata || undefined,
      createdAt: dbRecord.createdAt.toISOString(),
      user: dbRecord.user
        ? {
            id: dbRecord.user.id,
            name: dbRecord.user.name,
            email: dbRecord.user.email,
            avatarUrl: dbRecord.user.avatarUrl || '',
            title: dbRecord.user.headline || 'Developer',
            skills: [],
            status: dbRecord.user.status as any,
          }
        : actorUser || undefined,
      userName: dbRecord.user?.name || actorUser?.name || 'Developer',
      userAvatar: dbRecord.user?.avatarUrl || actorUser?.avatarUrl || '',
      title: summary.title,
      details: summary.details,
      timestamp: 'Just now',
      eventType: actionType,
    };
  } catch (err) {
    // In-memory fallback
    const id = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    createdLog = {
      id,
      projectId,
      userId,
      actionType,
      entityId,
      entityType,
      metadata: metaString || undefined,
      createdAt: new Date().toISOString(),
      user: actorUser || undefined,
      userName: actorUser?.name || 'Developer',
      userAvatar: actorUser?.avatarUrl || '',
      title: summary.title,
      details: summary.details,
      timestamp: 'Just now',
      eventType: actionType,
    };
  }

  // Update in-memory devconnect store if present
  if (globalThis.__devconnect_store) {
    globalThis.__devconnect_store.activity.unshift(createdLog);
  }

  // Broadcast to Realtime Gateway via HTTP
  await emitRealtimeEvent('activity_logged', {
    projectId,
    actionType,
    activity: createdLog,
  });

  return createdLog;
}

/**
 * Retrieves paginated chronological activity feed for a project
 */
export async function getActivityFeed(
  projectId: string,
  options?: { limit?: number; offset?: number; actionType?: string }
): Promise<{ activities: ActivityLog[]; total: number }> {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  try {
    const whereClause: any = { projectId };
    if (options?.actionType) {
      whereClause.actionType = options.actionType;
    }

    const [dbLogs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where: whereClause,
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count({ where: whereClause }),
    ]);

    if (dbLogs && dbLogs.length > 0) {
      const activities: ActivityLog[] = dbLogs.map((log) => {
        let metaObj: Record<string, any> | null = null;
        if (log.metadata) {
          try {
            metaObj = JSON.parse(log.metadata);
          } catch {}
        }
        const summary = formatActivitySummary(log.actionType, metaObj);
        return {
          id: log.id,
          projectId: log.projectId,
          userId: log.userId,
          actionType: log.actionType,
          entityId: log.entityId || undefined,
          entityType: log.entityType || undefined,
          metadata: log.metadata || undefined,
          createdAt: log.createdAt.toISOString(),
          user: log.user
            ? {
                id: log.user.id,
                name: log.user.name,
                email: log.user.email,
                avatarUrl: log.user.avatarUrl || '',
                title: log.user.headline || 'Developer',
                skills: [],
                status: log.user.status as any,
              }
            : undefined,
          userName: log.user?.name || 'Developer',
          userAvatar: log.user?.avatarUrl || '',
          title: summary.title,
          details: summary.details,
          timestamp: new Date(log.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          eventType: log.actionType,
        };
      });

      return { activities, total };
    }
  } catch (err) {
    // Fallback to in-memory store
  }

  const inMem = globalThis.__devconnect_store?.activity.filter((a) => a.projectId === projectId) || [];
  const filtered = options?.actionType ? inMem.filter((a) => a.actionType === options.actionType || a.eventType === options.actionType) : inMem;
  const paginated = filtered.slice(offset, offset + limit);

  return {
    activities: paginated,
    total: filtered.length,
  };
}
