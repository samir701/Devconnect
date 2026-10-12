import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import { getActivityFeed } from '@/lib/activity';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await props.params;
    const userId = getSessionUserId(request);

    // Any project member can view project activity
    const authCheck = await checkProjectPermission(userId, projectId);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const actionType = searchParams.get('actionType') || undefined;

    const { activities, total } = await getActivityFeed(projectId, {
      limit: Math.min(limit, 100),
      offset: Math.max(offset, 0),
      actionType,
    });

    return NextResponse.json({
      activities,
      total,
      limit,
      offset,
      projectId,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to retrieve project activity';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
