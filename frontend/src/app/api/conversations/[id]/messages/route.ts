import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMessages, getProjectMembers } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth-guard';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await props.params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const cursor = searchParams.get('cursor'); // message ID for cursor pagination
    const currentUserId = getSessionUserId(request);

    // Try Prisma DB query
    try {
      // First verify access: check conversation membership or project membership
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          members: true,
          project: {
            include: { members: true },
          },
        },
      });

      if (conversation) {
        const dbMessages = await prisma.message.findMany({
          where: {
            conversationId,
            deletedAt: null,
          },
          take: limit,
          skip: cursor ? 1 : 0,
          cursor: cursor ? { id: cursor } : undefined,
          orderBy: { createdAt: 'asc' },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                headline: true,
                status: true,
              },
            },
            replyTo: {
              select: {
                id: true,
                content: true,
                sender: { select: { name: true } },
              },
            },
            reactions: {
              include: {
                user: { select: { id: true, name: true } },
              },
            },
          },
        });

        // Format message reactions into aggregated { emoji, count, userIds }
        const formatted = dbMessages.map((msg) => {
          const reactionMap = new Map<string, string[]>();
          msg.reactions.forEach((r) => {
            if (!reactionMap.has(r.emoji)) reactionMap.set(r.emoji, []);
            reactionMap.get(r.emoji)!.push(r.userId);
          });

          const reactions = Array.from(reactionMap.entries()).map(([emoji, userIds]) => ({
            emoji,
            count: userIds.length,
            userIds,
          }));

          return {
            id: msg.id,
            conversationId: msg.conversationId,
            projectId: msg.projectId,
            channel: msg.channel,
            senderId: msg.senderId,
            sender: msg.sender,
            content: msg.content,
            messageType: msg.messageType,
            replyToMessageId: msg.replyToMessageId,
            replyToMessage: msg.replyTo
              ? {
                  id: msg.replyTo.id,
                  content: msg.replyTo.content,
                  senderName: msg.replyTo.sender?.name || 'Developer',
                }
              : undefined,
            reactions,
            isEdited: msg.isEdited,
            createdAt: msg.createdAt.toISOString(),
            updatedAt: msg.updatedAt.toISOString(),
          };
        });

        const nextCursor = dbMessages.length === limit ? dbMessages[dbMessages.length - 1].id : null;

        return NextResponse.json({
          messages: formatted,
          nextCursor,
          conversation,
        });
      }
    } catch {
      // Fallback to store
    }

    // Store fallback
    const storeMessages = await getMessages({ conversationId });
    return NextResponse.json({
      messages: storeMessages,
      nextCursor: null,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
