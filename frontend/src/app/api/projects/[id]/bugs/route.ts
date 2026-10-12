import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import { getBugs, createBug, createMessage } from '@/lib/db';
import { ProjectRole } from '@/lib/types';

const MUTATION_ROLES: ProjectRole[] = ['OWNER', 'ADMIN', 'DEVELOPER', 'QA'];

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await props.params;
    const userId = getSessionUserId(request);

    // Any project member can view bugs
    const authCheck = await checkProjectPermission(userId, projectId);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const priorityFilter = searchParams.get('priority');
    const assigneeFilter = searchParams.get('assignee') || searchParams.get('assignedTo');

    let bugs = await getBugs(projectId);

    if (statusFilter) {
      bugs = bugs.filter((b) => b.status.toUpperCase() === statusFilter.toUpperCase());
    }
    if (priorityFilter) {
      bugs = bugs.filter((b) => b.priority.toUpperCase() === priorityFilter.toUpperCase());
    }
    if (assigneeFilter) {
      bugs = bugs.filter((b) => b.assignedTo === assigneeFilter);
    }

    return NextResponse.json({ bugs, total: bugs.length });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve bugs';
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

    // Only non-VIEWER members can create bugs
    const authCheck = await checkProjectPermission(userId, projectId, MUTATION_ROLES);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'Bug title is required' }, { status: 400 });
    }

    const bug = await createBug({
      projectId,
      messageId: body.messageId || undefined,
      title: body.title.trim(),
      description: body.description?.trim() || '',
      endpoint: body.endpoint?.trim() || '',
      priority: body.priority || 'HIGH',
      status: body.status || 'OPEN',
      assignedTo: body.assignedTo || userId,
      createdBy: userId,
    });

    // Optionally notify project channel (#bugs)
    if (body.broadcastToChannel !== false) {
      try {
        await createMessage({
          projectId,
          channel: 'bugs',
          senderId: userId,
          content: `🐛 **[BUG]** ${bug.title}\n${bug.description || ''}`,
          messageType: 'BUG',
          metadata: JSON.stringify({
            bugId: bug.id,
            title: bug.title,
            endpoint: bug.endpoint,
            priority: bug.priority,
            status: bug.status,
            assignedTo: bug.assignedTo,
          }),
          bugData: bug,
        });
      } catch (err) {
        // Message creation non-blocking
      }
    }

    return NextResponse.json({ bug }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to create bug report';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
