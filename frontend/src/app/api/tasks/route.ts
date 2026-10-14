import { NextResponse } from 'next/server';
import { getTasks, createTask, getUserById, getProjectById } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { createNotification, getUserNotificationPreferences } from '@/lib/notifications';
import { sendTaskAssignedEmail } from '@/lib/email/notifications';
import { getSessionUserId } from '@/lib/auth-guard';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  let tasks = await getTasks(projectId);
  const statusFilter = searchParams.get('status');
  const priorityFilter = searchParams.get('priority');
  const assigneeFilter = searchParams.get('assignee') || searchParams.get('assignedTo');

  if (statusFilter) {
    tasks = tasks.filter((t) => t.status.toUpperCase() === statusFilter.toUpperCase());
  }
  if (priorityFilter) {
    tasks = tasks.filter((t) => t.priority.toUpperCase() === priorityFilter.toUpperCase());
  }
  if (assigneeFilter) {
    tasks = tasks.filter((t) => t.assignedTo === assigneeFilter);
  }

  return NextResponse.json({ tasks, total: tasks.length });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.title || !body.projectId) {
      return NextResponse.json({ error: 'Title and projectId are required' }, { status: 400 });
    }

    const sessionUserId = getSessionUserId(request);
    const creatorId = body.createdBy || sessionUserId;
    if (!creatorId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    const assigneeId = body.assignedTo || creatorId;

    const task = await createTask({
      projectId: body.projectId,
      messageId: body.messageId,
      title: body.title,
      description: body.description || '',
      priority: body.priority || 'MEDIUM',
      status: body.status || 'TODO',
      assignedTo: assigneeId,
      createdBy: creatorId,
      dueDate: body.dueDate || 'Today',
    });

    // ── Phase 6: Dispatch notifications when an assignee is set ──────────────
    if (assigneeId && assigneeId !== creatorId) {
      try {
        // In-app notification
        const assigneePrefs = await getUserNotificationPreferences(assigneeId);
        if (assigneePrefs.inAppAll) {
          await createNotification({
            recipientId: assigneeId,
            senderId: creatorId,
            projectId: body.projectId,
            type: 'TASK_ASSIGNED',
            priority: 'HIGH',
            title: `Task Assigned: ${body.title}`,
            message: `You have been assigned a new task: "${body.title}"`,
            entityId: task.id,
            entityType: 'TASK',
          });
        }

        // Email notification
        if (assigneePrefs.emailOnTaskAssigned) {
          let creatorUser = null;
          let assigneeUser = null;
          let projectData = null;

          try {
            [creatorUser, assigneeUser, projectData] = await Promise.all([
              prisma.user.findUnique({ where: { id: creatorId }, select: { name: true, email: true } }),
              prisma.user.findUnique({ where: { id: assigneeId }, select: { name: true, email: true } }),
              prisma.project.findUnique({ where: { id: body.projectId }, select: { name: true } }),
            ]);
          } catch {}

          if (!creatorUser) {
            const u = await getUserById(creatorId);
            if (u) creatorUser = { name: u.name, email: u.email };
          }
          if (!assigneeUser) {
            const u = await getUserById(assigneeId);
            if (u) assigneeUser = { name: u.name, email: u.email };
          }
          if (!projectData) {
            const p = await getProjectById(body.projectId);
            if (p) projectData = { name: p.name };
          }

          if (creatorUser && assigneeUser && projectData) {
            sendTaskAssignedEmail({ task, creator: creatorUser, assignee: assigneeUser, project: projectData }).catch(console.error);
          }
        }
      } catch (notifErr) {
        console.error('[Tasks] Notification error (non-fatal):', notifErr);
      }
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

