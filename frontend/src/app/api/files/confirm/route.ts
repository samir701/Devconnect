import { NextResponse } from 'next/server';
import { getSessionUserId } from '@/lib/auth-guard';
import { getAttachmentById, updateAttachment } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { attachmentId, messageId, projectId, conversationId } = body;

    if (!attachmentId) {
      return NextResponse.json({ error: 'attachmentId is required' }, { status: 400 });
    }

    const attachment = await getAttachmentById(attachmentId);
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Link the attachment to messageId and/or projectId
    const updated = await updateAttachment(attachmentId, {
      messageId: messageId || attachment.messageId,
      projectId: projectId || attachment.projectId,
    });

    // Broadcast file upload notification to Realtime Socket Gateway if reachable
    try {
      const socketServerUrl =
        process.env.INTERNAL_SOCKET_URL ||
        process.env.NEXT_PUBLIC_SOCKET_URL ||
        (process.env.NODE_ENV === 'production'
          ? 'https://devconnect-a2wa.onrender.com'
          : 'http://localhost:3001');

      // Non-blocking trigger to socket server
      fetch(`${socketServerUrl}/api/events/file_uploaded`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'FILE_UPLOADED',
          attachment: updated || attachment,
          userId,
          projectId: projectId || attachment.projectId,
          conversationId,
          messageId,
        }),
      }).catch(() => {
        // Socket HTTP gateway is optional
      });
    } catch {
      // Ignore broadcast errors
    }

    return NextResponse.json({
      success: true,
      attachment: updated || attachment,
      message: 'Upload confirmed and linked to message/project',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
