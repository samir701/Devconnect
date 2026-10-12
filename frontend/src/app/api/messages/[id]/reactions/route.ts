import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { toggleMessageReaction } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth-guard';

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: messageId } = await props.params;
    const body = await request.json();
    const currentUserId = getSessionUserId(request);
    const emoji = body.emoji;

    if (!emoji) {
      return NextResponse.json({ error: 'Emoji is required' }, { status: 400 });
    }

    // Try Prisma DB toggle
    try {
      const existingReaction = await prisma.messageReaction.findUnique({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId: currentUserId,
            emoji,
          },
        },
      });

      let action = 'ADDED';
      if (existingReaction) {
        await prisma.messageReaction.delete({
          where: { id: existingReaction.id },
        });
        action = 'REMOVED';
      } else {
        await prisma.messageReaction.create({
          data: {
            messageId,
            userId: currentUserId,
            emoji,
          },
        });
      }

      // Fetch all reactions for this message
      const allReactions = await prisma.messageReaction.findMany({
        where: { messageId },
      });

      const reactionMap = new Map<string, string[]>();
      allReactions.forEach((r) => {
        if (!reactionMap.has(r.emoji)) reactionMap.set(r.emoji, []);
        reactionMap.get(r.emoji)!.push(r.userId);
      });

      const aggregated = Array.from(reactionMap.entries()).map(([em, userIds]) => ({
        emoji: em,
        count: userIds.length,
        userIds,
      }));

      // Update store as well
      await toggleMessageReaction(messageId, currentUserId, emoji);

      return NextResponse.json({
        messageId,
        reactions: aggregated,
        action,
      });
    } catch {
      // Store fallback
      const updated = await toggleMessageReaction(messageId, currentUserId, emoji);
      if (!updated) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      return NextResponse.json({
        messageId,
        reactions: updated.reactions || [],
        action: 'TOGGLED',
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
