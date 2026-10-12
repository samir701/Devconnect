import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUserId } from '@/lib/auth-guard';
import { getUserById } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const otherUserId = searchParams.get('otherUserId');
    const currentUserId = getSessionUserId(request);

    if (!otherUserId) {
      return NextResponse.json({ error: 'otherUserId parameter is required' }, { status: 400 });
    }

    if (currentUserId === otherUserId) {
      return NextResponse.json({ error: 'Cannot create a direct conversation with yourself' }, { status: 400 });
    }

    // Verify other user exists
    const otherUser = await getUserById(otherUserId);
    if (!otherUser) {
      return NextResponse.json({ error: 'Recipient user not found' }, { status: 404 });
    }

    // Try finding existing DIRECT conversation in Prisma
    try {
      const existing = await prisma.conversation.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId: currentUserId } } },
            { members: { some: { userId: otherUserId } } },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatarUrl: true, headline: true, status: true },
              },
            },
          },
        },
      });

      if (existing) {
        return NextResponse.json({
          conversation: {
            ...existing,
            otherUser,
          },
        });
      }

      // Create new DIRECT conversation atomically
      const newConversation = await prisma.$transaction(async (tx) => {
        const created = await tx.conversation.create({
          data: {
            type: 'DIRECT',
          },
        });

        await tx.conversationMember.createMany({
          data: [
            { conversationId: created.id, userId: currentUserId },
            { conversationId: created.id, userId: otherUserId },
          ],
        });

        return created;
      });

      return NextResponse.json(
        {
          conversation: {
            ...newConversation,
            otherUser,
          },
        },
        { status: 201 }
      );
    } catch {
      // Fallback for store/mock
      const dmId = `conv_${[currentUserId, otherUserId].sort().join('_')}`;
      return NextResponse.json({
        conversation: {
          id: dmId,
          type: 'DIRECT',
          participantIds: [currentUserId, otherUserId],
          otherUser,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
