import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteMessage } from '@/lib/db';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const currentUserId = getSessionUserId(request);
    const body = await request.json();
    const content = body.content;

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
    }

    // Try Prisma DB update
    try {
      const message = await prisma.message.findUnique({ where: { id } });
      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      if (message.senderId !== currentUserId) {
        return NextResponse.json({ error: 'Forbidden: You can only edit your own messages' }, { status: 403 });
      }

      const updated = await prisma.message.update({
        where: { id },
        data: {
          content: content.trim(),
          isEdited: true,
        },
      });

      return NextResponse.json({ message: updated });
    } catch {
      // Store fallback
      return NextResponse.json({
        message: { id, content: content.trim(), isEdited: true },
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const currentUserId = getSessionUserId(request);

    // Try Prisma DB soft-delete
    try {
      const message = await prisma.message.findUnique({ where: { id } });
      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }

      const isAuthor = message.senderId === currentUserId;
      if (!isAuthor && message.projectId) {
        const guard = await checkProjectPermission(currentUserId, message.projectId, ['OWNER', 'ADMIN']);
        if (!guard.authorized) {
          return NextResponse.json({ error: 'Forbidden: You do not have permission to delete this message' }, { status: 403 });
        }
      }

      await prisma.message.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    } catch {
      // Ignore Prisma errors if store
    }

    const success = await deleteMessage(id);
    if (!success) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
