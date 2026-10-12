import { NextResponse } from 'next/server';
import { getActivityFeed } from '@/lib/activity';
import { getActivity } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const actionType = searchParams.get('actionType') || undefined;

  try {
    const { activities, total } = await getActivityFeed(projectId, {
      limit,
      offset,
      actionType,
    });
    return NextResponse.json({ activity: activities, activities, total });
  } catch {
    const fallback = await getActivity(projectId);
    return NextResponse.json({ activity: fallback, activities: fallback, total: fallback.length });
  }
}
