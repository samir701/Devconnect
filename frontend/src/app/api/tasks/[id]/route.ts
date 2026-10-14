import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import { updateTask, getUserById, getProjectById } from '@/lib/db';
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

    // ── Phase 6: Notify task creator when task is marked COMPLETED ────────────
    const isNowCompleted = body.status === 'COMPLETED' && previousStatus !== 'COMPLETED';
    const creatorId = existingTask.createdBy;
    const completerId = body.userId || body.completedBy || userId;

    if (isNowCompleted && creatorId && completerId !== creatorId) {
      try {
        const creatorPrefs = await getUserNotificationPreferences(creatorId);
        if (creatorPrefs.inAppAll) {
          await createNotification({
            recipientId: creatorId,
            senderId: completerId,
            projectId: existingTask.projectId,
            type: 'TASK_COMPLETED',
            priority: 'NORMAL',
            title: `Task Completed: ${existingTask.title}`,
            message: `Your task "${existingTask.title}" has been marked as completed.`,
            entityId: existingTask.id,
            entityType: 'TASK',
          });
        }

        if (creatorPrefs.emailOnTaskCompleted) {
          let completer = null;
          let creator = null;
          let project = null;

          try {
            [completer, creator, project] = await Promise.all([
              prisma.user.findUnique({ where: { id: completerId }, select: { name: true, email: true } }),
              prisma.user.findUnique({ where: { id: creatorId }, select: { name: true, email: true } }),
              prisma.project.findUnique({ where: { id: existingTask.projectId }, select: { name: true } }),
            ]);
          } catch {}

          if (!completer) {
            const u = await getUserById(completerId);
            if (u) completer = { name: u.name, email: u.email };
          }
          if (!creator) {
            const u = await getUserById(creatorId);
            if (u) creator = { name: u.name, email: u.email };
          }
          if (!project) {
            const p = await getProjectById(existingTask.projectId);
            if (p) project = { name: p.name };
          }

          if (completer && creator && project) {
            sendTaskCompletedEmail({ task: existingTask, completer, creator, project }).catch(console.error);
          }
        }
      } catch (notifErr) {
        console.error('[Tasks] Completion notification error (non-fatal):', notifErr);
      }
    }

    // ── Phase 6: Notify newly assigned team member if assignedTo changed ──────
    const newAssigneeId = body.assignedTo;
    if (newAssigneeId && newAssigneeId !== existingTask.assignedTo && newAssigneeId !== completerId) {
      try {
        const assigneePrefs = await getUserNotificationPreferences(newAssigneeId);
        if (assigneePrefs.inAppAll) {
          await createNotification({
            recipientId: newAssigneeId,
            senderId: completerId,
            projectId: existingTask.projectId,
            type: 'TASK_ASSIGNED',
            priority: 'HIGH',
            title: `Task Assigned: ${existingTask.title}`,
            message: `You have been assigned a task: "${existingTask.title}"`,
            entityId: existingTask.id,
            entityType: 'TASK',
          });
        }

        if (assigneePrefs.emailOnTaskAssigned) {
          let assigner = null;
          let assignee = null;
          let project = null;

          try {
            [assigner, assignee, project] = await Promise.all([
              prisma.user.findUnique({ where: { id: completerId }, select: { name: true, email: true } }),
              prisma.user.findUnique({ where: { id: newAssigneeId }, select: { name: true, email: true } }),
              prisma.project.findUnique({ where: { id: existingTask.projectId }, select: { name: true } }),
            ]);
          } catch {}

          if (!assigner) {
            const u = await getUserById(completerId);
            if (u) assigner = { name: u.name, email: u.email };
          }
          if (!assignee) {
            const u = await getUserById(newAssigneeId);
            if (u) assignee = { name: u.name, email: u.email };
          }
          if (!project) {
            const p = await getProjectById(existingTask.projectId);
            if (p) project = { name: p.name };
          }

          if (assigner && assignee && project) {
            sendTaskAssignedEmail({ task: existingTask, creator: assigner, assignee, project }).catch(console.error);
          }
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

