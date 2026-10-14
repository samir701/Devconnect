import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { deleteMessage, updateMessage } from '@/lib/db';
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

      const updated = await prisma.message.update({
        where: { id },
        data: {
          content: content.trim(),
          isEdited: true,
        },
      });

      await updateMessage(id, content);

      return NextResponse.json({ message: updated });
    } catch {
      // Store fallback with disk persistence
      const updated = await updateMessage(id, content);
      return NextResponse.json({
        message: updated || { id, content: content.trim(), isEdited: true },
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

    // Try Prisma DB soft-delete
    try {
      const message = await prisma.message.findUnique({ where: { id } });
      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
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
