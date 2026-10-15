import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import { getTasks, createTask, createMessage, getUserById, getProjectById } from '@/lib/db';
import { sendTaskAssignedEmail } from '@/lib/email/notifications';
import { ProjectRole } from '@/lib/types';

const MUTATION_ROLES: ProjectRole[] = ['OWNER', 'ADMIN', 'DEVELOPER', 'QA'];

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await props.params;
    const userId = getSessionUserId(request);

    // Any project member can view tasks
    const authCheck = await checkProjectPermission(userId, projectId);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const priorityFilter = searchParams.get('priority');
    const assigneeFilter = searchParams.get('assignee') || searchParams.get('assignedTo');

    let tasks = await getTasks(projectId);

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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve tasks';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await props.params;
    const userId = getSessionUserId(request);

    // Only non-VIEWER members can create tasks
    const authCheck = await checkProjectPermission(userId, projectId, MUTATION_ROLES);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    const task = await createTask({
      projectId,
      messageId: body.messageId || undefined,
      title: body.title.trim(),
      description: body.description?.trim() || '',
      priority: body.priority || 'MEDIUM',
      status: body.status || 'TODO',
      assignedTo: body.assignedTo || userId,
      createdBy: userId,
      dueDate: body.dueDate || undefined,
    });

    // Optionally notify project channel (#tasks or general)
    if (body.broadcastToChannel !== false) {
      try {
        await createMessage({
          projectId,
          channel: 'tasks',
          senderId: userId,
          content: `📋 **[TASK]** ${task.title}\n${task.description || ''}`,
          messageType: 'TASK',
          metadata: JSON.stringify({
            taskId: task.id,
            title: task.title,
            priority: task.priority,
            status: task.status,
            assignedTo: task.assignedTo,
            dueDate: task.dueDate,
          }),
          taskData: task,
        });
      } catch (err) {
        // Message creation non-blocking
      }
    }

    // Email notification via Resend tracking login emails from TiDB database
    if (task.assignedTo && task.assignedTo !== userId) {
      try {
        const [creatorUser, assigneeUser, projectData] = await Promise.all([
          getUserById(userId),
          getUserById(task.assignedTo),
          getProjectById(projectId),
        ]);

        if (creatorUser && assigneeUser && assigneeUser.email) {
          console.log(`[Project Tasks] Dispatching task assigned email from ${creatorUser.email} to ${assigneeUser.email} for task: "${task.title}"`);
          await sendTaskAssignedEmail({
            task,
            creator: { name: creatorUser.name || 'Project Member', email: creatorUser.email },
            assignee: { name: assigneeUser.name || 'Assignee', email: assigneeUser.email },
            project: { name: projectData?.name || 'Devconnect Workspace' },
          });
        }
      } catch (notifErr) {
        console.error('[Project Tasks] Notification error (non-fatal):', notifErr);
      }
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create task';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
