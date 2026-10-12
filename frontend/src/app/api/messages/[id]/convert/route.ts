import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import { createTask, createBug } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { logActivity, emitRealtimeEvent } from '@/lib/activity';
import { ProjectRole, PriorityLevel, TaskStatus, BugStatus } from '@/lib/types';

const MUTATION_ROLES: ProjectRole[] = ['OWNER', 'ADMIN', 'DEVELOPER', 'QA'];

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await props.params;
    const userId = getSessionUserId(request);
    const body = await request.json();

    const targetType: 'TASK' | 'BUG' = (body.type || 'TASK').toUpperCase();
    if (targetType !== 'TASK' && targetType !== 'BUG') {
      return NextResponse.json({ error: 'Type must be TASK or BUG' }, { status: 400 });
    }

    // 1. Locate message
    let message: any = null;
    try {
      message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { sender: true },
      });
    } catch {}

    if (!message && globalThis.__devconnect_store) {
      message = globalThis.__devconnect_store.messages.find((m) => m.id === messageId);
    }

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    const projectId = message.projectId || body.projectId;
    if (!projectId) {
      return NextResponse.json({ error: 'Message is not associated with a project' }, { status: 400 });
    }

    // 2. Verify RBAC permissions (VIEWER cannot convert messages)
    const authCheck = await checkProjectPermission(userId, projectId, MUTATION_ROLES);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    // Extract default title and description from message content
    const rawContent = message.content || '';
    const firstLine = rawContent.split('\n')[0].replace(/^[#*\s-]+/, '').trim();
    const fallbackTitle = firstLine.length > 80 ? `${firstLine.substring(0, 77)}...` : firstLine || 'Converted Item';

    const itemTitle = (body.title || fallbackTitle).trim();
    const itemDescription = (body.description || rawContent).trim();
    const itemPriority: PriorityLevel = body.priority || (targetType === 'BUG' ? 'HIGH' : 'MEDIUM');

    if (targetType === 'TASK') {
      const task = await createTask({
        projectId,
        messageId: message.id,
        title: itemTitle,
        description: itemDescription,
        priority: itemPriority,
        status: (body.status as TaskStatus) || 'TODO',
        assignedTo: body.assignedTo || userId,
        createdBy: userId,
        dueDate: body.dueDate || undefined,
      });

      // Update message metadata and type in TiDB Cloud & memory
      const metadataStr = JSON.stringify({
        taskId: task.id,
        title: task.title,
        priority: task.priority,
        status: task.status,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate,
        convertedAt: new Date().toISOString(),
      });

      try {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            messageType: 'TASK',
            metadata: metadataStr,
          },
        });
      } catch {}

      if (globalThis.__devconnect_store) {
        const memMsg = globalThis.__devconnect_store.messages.find((m) => m.id === message.id);
        if (memMsg) {
          memMsg.messageType = 'TASK';
          memMsg.taskData = task;
          memMsg.metadata = metadataStr;
        }
      }

      // Log Conversion Activity
      await logActivity({
        projectId,
        userId,
        actionType: 'MESSAGE_CONVERTED',
        entityId: task.id,
        entityType: 'TASK',
        metadata: {
          targetType: 'TASK',
          messageId: message.id,
          title: task.title,
          taskId: task.id,
        },
        title: `Message converted to Task: ${task.title}`,
        details: `Converted by ${userId}`,
      });

      await emitRealtimeEvent('message_converted', {
        projectId,
        messageId: message.id,
        convertedType: 'TASK',
        task,
      });

      return NextResponse.json({
        success: true,
        type: 'TASK',
        task,
        messageId: message.id,
      }, { status: 201 });
    } else {
      // BUG
      const bug = await createBug({
        projectId,
        messageId: message.id,
        title: itemTitle,
        description: itemDescription,
        endpoint: body.endpoint || undefined,
        priority: itemPriority,
        status: (body.status as BugStatus) || 'OPEN',
        assignedTo: body.assignedTo || userId,
        createdBy: userId,
      });

      const metadataStr = JSON.stringify({
        bugId: bug.id,
        title: bug.title,
        endpoint: bug.endpoint,
        priority: bug.priority,
        status: bug.status,
        assignedTo: bug.assignedTo,
        convertedAt: new Date().toISOString(),
      });

      try {
        await prisma.message.update({
          where: { id: message.id },
          data: {
            messageType: 'BUG',
            metadata: metadataStr,
          },
        });
      } catch {}

      if (globalThis.__devconnect_store) {
        const memMsg = globalThis.__devconnect_store.messages.find((m) => m.id === message.id);
        if (memMsg) {
          memMsg.messageType = 'BUG';
          memMsg.bugData = bug;
          memMsg.metadata = metadataStr;
        }
      }

      // Log Conversion Activity
      await logActivity({
        projectId,
        userId,
        actionType: 'MESSAGE_CONVERTED',
        entityId: bug.id,
        entityType: 'BUG',
        metadata: {
          targetType: 'BUG',
          messageId: message.id,
          title: bug.title,
          bugId: bug.id,
        },
        title: `Message converted to Bug: ${bug.title}`,
        details: `Converted by ${userId}`,
      });

      await emitRealtimeEvent('message_converted', {
        projectId,
        messageId: message.id,
        convertedType: 'BUG',
        bug,
      });

      return NextResponse.json({
        success: true,
        type: 'BUG',
        bug,
        messageId: message.id,
      }, { status: 201 });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to convert message';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
