import { NextResponse } from 'next/server';
import { getConversations } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId') || 'user_samir';
  const conversations = await getConversations(userId);
  return NextResponse.json({ conversations });
}
