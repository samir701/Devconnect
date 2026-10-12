import { NextResponse } from 'next/server';
import { getBugs, createBug } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  let bugs = await getBugs(projectId);
  const statusFilter = searchParams.get('status');
  const priorityFilter = searchParams.get('priority');
  const assigneeFilter = searchParams.get('assignee') || searchParams.get('assignedTo');

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
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.title || !body.projectId) {
      return NextResponse.json({ error: 'Title and projectId are required' }, { status: 400 });
    }

    const bug = await createBug({
      projectId: body.projectId,
      messageId: body.messageId,
      title: body.title,
      description: body.description || '',
      endpoint: body.endpoint || '',
      priority: body.priority || 'HIGH',
      status: body.status || 'OPEN',
      assignedTo: body.assignedTo || 'user_samir',
      createdBy: body.createdBy || 'user_samir',
    });

    return NextResponse.json({ bug }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
