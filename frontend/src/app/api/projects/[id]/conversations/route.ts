import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkProjectPermission, getSessionUserId } from '@/lib/auth-guard';
import { getProjectById } from '@/lib/db';

const DEFAULT_CHANNELS = ['general', 'development', 'bugs', 'tasks', 'files', 'activity'];

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await props.params;
    const currentUserId = getSessionUserId(request);

    // RBAC: Verify user is a member of the project
    const guard = await checkProjectPermission(currentUserId, projectId);
    if (!guard.authorized) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    // Try Prisma DB query
    try {
      let conversations = await prisma.conversation.findMany({
        where: {
          projectId,
          type: 'PROJECT_CHANNEL',
        },
        orderBy: { createdAt: 'asc' },
      });

      // Auto-provision default channels if none exist yet
      if (conversations.length === 0) {
        await prisma.conversation.createMany({
          data: DEFAULT_CHANNELS.map((name) => ({
            projectId,
            name,
            type: 'PROJECT_CHANNEL',
          })),
        });

        conversations = await prisma.conversation.findMany({
          where: {
            projectId,
            type: 'PROJECT_CHANNEL',
          },
          orderBy: { createdAt: 'asc' },
        });
      }

      return NextResponse.json({ conversations });
    } catch {
      // Store fallback
      const project = await getProjectById(projectId);
      const channels = project?.channels || DEFAULT_CHANNELS;
      const mockConversations = channels.map((name) => ({
        id: `conv_${projectId}_${name}`,
        projectId,
        name,
        type: 'PROJECT_CHANNEL',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      return NextResponse.json({ conversations: mockConversations });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
