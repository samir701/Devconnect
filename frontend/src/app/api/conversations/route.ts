import { NextResponse } from 'next/server';
import { getConversations } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth-guard';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ conversations: [] });
  }
  const conversations = await getConversations(userId);
  return NextResponse.json({ conversations });
}
