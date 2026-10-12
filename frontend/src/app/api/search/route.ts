import { NextResponse } from 'next/server';
import { searchAll } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const projectId = searchParams.get('projectId') || undefined;

  const results = await searchAll(q, projectId);
  return NextResponse.json({
    query: q,
    results,
    totalCount:
      results.messages.length +
      results.tasks.length +
      results.bugs.length +
      results.files.length +
      results.users.length,
  });
}
