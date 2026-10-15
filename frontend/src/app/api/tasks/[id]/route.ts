import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import { updateTask, getUserById, getProjectById, tidbClient } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { ProjectRole } from '@/lib/types';
import { createNotification, getUserNotificationPreferences } from '@/lib/notifications';
import { sendTaskCompletedEmail, sendTaskAssignedEmail } from '@/lib/email/notifications';


const MUTATION_ROLES: ProjectRole[] = ['OWNER', 'ADMIN', 'DEVELOPER', 'QA'];

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    let task: any = null;

    try {
      task = await prisma.task.findUnique({
        where: { id },
        include: { assignee: true, creator: true },
      });
    } catch {}

    if (!task && globalThis.__devconnect_store) {
      task = globalThis.__devconnect_store.tasks.get(id);
    }

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const userId = getSessionUserId(request);
    const authCheck = await checkProjectPermission(userId, task.projectId);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    return NextResponse.json({ task });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve task';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const userId = getSessionUserId(request);

    // Look up task to find its projectId for RBAC check
    let existingTask: any = null;
    try {
      existingTask = await prisma.task.findUnique({ where: { id } });
    } catch {}

    if (!existingTask && globalThis.__devconnect_store) {
      existingTask = globalThis.__devconnect_store.tasks.get(id);
    }

    if (!existingTask) {
      const stripped = id.replace(/^task_/, '');
      try {
        existingTask = await prisma.task.findFirst({
          where: {
            OR: [
              { messageId: id },
              { messageId: stripped },
            ],
          },
          include: { assignee: true, creator: true },
        });
      } catch {}

      if (!existingTask) {
        try {
          const dbMsg = await prisma.message.findFirst({
            where: { OR: [{ id }, { id: stripped }] },
          });
          if (dbMsg) {
            let meta: any = {};
            try { if (dbMsg.metadata) meta = JSON.parse(dbMsg.metadata); } catch {}
            existingTask = await prisma.task.create({
              data: {
                id: meta?.taskId || id,
                projectId: dbMsg.projectId || 'proj_ai_employee',
                messageId: dbMsg.id,
                title: meta?.title || dbMsg.content.replace(/^📋\s*(?:\*\*\[TASK\]\*\*)?:?\s*/i, '').slice(0, 80) || 'Task',
                description: meta?.description || dbMsg.content,
                priority: meta?.priority || 'MEDIUM',
                status: 'TODO',
                assignedTo: meta?.assignedTo || dbMsg.senderId,
                createdBy: dbMsg.senderId,
              },
              include: { assignee: true, creator: true },
            });
          }
        } catch {}
      }

      if (!existingTask && tidbClient) {
        try {
          const stripped = id.replace(/^task_/, '');
          const rows = (await tidbClient.execute(
            'SELECT * FROM tasks WHERE id = ? OR id = ? OR messageId = ? OR messageId = ? LIMIT 1',
            [id, stripped, id, stripped]
          )) as any[];
          if (rows && rows.length > 0) {
            existingTask = rows[0];
          }
        } catch (tidbErr) {
          console.warn('[TiDB] Failed to query task via serverless in PATCH:', tidbErr);
        }
      }
    }

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // RBAC: Only non-VIEWER members can modify tasks
    const authCheck = await checkProjectPermission(userId, existingTask.projectId, MUTATION_ROLES);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    const previousStatus = existingTask.status;
    const updated = await updateTask(existingTask.id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // ── Phase 6: Notify task creator when task is marked COMPLETED (tick in checkbox) ──
    const isNowCompleted = body.status === 'COMPLETED' && previousStatus !== 'COMPLETED';
    const creatorId = existingTask.createdBy;
    const completerId = body.userId || body.completedBy || userId || existingTask.assignedTo;

    if (isNowCompleted && creatorId) {
      try {
        let completer = null;
        let creator = null;
        let project = null;

        try {
          [creator, completer, project] = await Promise.all([
            getUserById(creatorId),
            getUserById(completerId),
            getProjectById(existingTask.projectId),
          ]);
        } catch (fetchErr) {
          console.warn('[Tasks] User lookup error for completion notification:', fetchErr);
        }

        if (!completer && existingTask.assignedTo) {
          completer = await getUserById(existingTask.assignedTo);
        }
        if (!completer) {
          completer = { name: 'Team Member', email: 'team@devconnect.dev' } as any;
        }
        if (!project) {
          project = { name: 'Devconnect Workspace' };
        }

        // In-app notification
        try {
          await createNotification({
            recipientId: creatorId,
            senderId: completerId || creatorId,
            projectId: existingTask.projectId,
            type: 'TASK_COMPLETED',
            priority: 'NORMAL',
            title: `Task Completed: ${existingTask.title}`,
            message: `Your task "${existingTask.title}" has been marked as completed by ${completer.name || 'a team member'}.`,
            entityId: existingTask.id,
            entityType: 'TASK',
          });
        } catch {}

        // Resend transactional email notification to Person A (task creator)
        if (creator && creator.email) {
          console.log(`[Tasks] Dispatching task completed email to creator ${creator.email} via Resend for task: "${existingTask.title}"`);
          await sendTaskCompletedEmail({
            task: existingTask,
            completer: { name: completer.name || 'Team Member', email: completer.email || 'team@devconnect.dev' },
            creator: { name: creator.name || 'Task Creator', email: creator.email },
            project: { name: project.name || 'Devconnect Workspace' },
          });
        } else {
          console.warn('[Tasks] Could not find creator email in TiDB for completion notification:', creatorId);
        }
      } catch (notifErr) {
        console.error('[Tasks] Completion notification error (non-fatal):', notifErr);
      }
    }

    // ── Phase 6: Notify newly assigned team member if assignedTo changed ──────
    const newAssigneeId = body.assignedTo;
    if (newAssigneeId && newAssigneeId !== existingTask.assignedTo) {
      try {
        const [assigner, assignee, project] = await Promise.all([
          getUserById(completerId),
          getUserById(newAssigneeId),
          getProjectById(existingTask.projectId),
        ]);

        if (assignee && assignee.email) {
          console.log(`[Tasks] Dispatching reassignment email to ${assignee.email} via Resend`);
          await sendTaskAssignedEmail({
            task: existingTask,
            creator: { name: assigner?.name || 'Project Member', email: assigner?.email || 'notifications@devconnect.dev' },
            assignee: { name: assignee.name || 'Assignee', email: assignee.email },
            project: { name: project?.name || 'Devconnect Workspace' },
          });
        }
      } catch (assignErr) {
        console.error('[Tasks] Assignment notification error (non-fatal):', assignErr);
      }
    }

    return NextResponse.json({ task: updated });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to update task';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

