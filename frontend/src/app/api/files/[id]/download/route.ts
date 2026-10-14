import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { getAttachmentById } from '@/lib/db';
import {
  generateDownloadUrl,
  readLocalFallbackFile,
  isB2Configured,
} from '@/lib/storage/b2';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const userId = getSessionUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to download files' },
        { status: 401 }
      );
    }

    // 1. Fetch file attachment metadata
    let attachment = null;
    try {
      attachment = await prisma.attachment.findUnique({
        where: { id },
        include: {
          project: {
            include: { members: true },
          },
          message: {
            include: {
              conversation: {
                include: { members: true },
              },
            },
          },
        },
      });
    } catch {
      // In-memory fallback
    }

    if (!attachment) {
      const fallbackAtt = await getAttachmentById(id);
      if (!fallbackAtt) {
        return NextResponse.json({ error: 'File attachment not found' }, { status: 404 });
      }
      attachment = {
        id: fallbackAtt.id,
        storageKey: fallbackAtt.storageKey,
        fileName: fallbackAtt.fileName,
        fileType: fallbackAtt.fileType || fallbackAtt.mimeType || 'application/octet-stream',
        fileSize: fallbackAtt.fileSize,
        uploaderId: fallbackAtt.uploaderId || fallbackAtt.userId || '',
        projectId: fallbackAtt.projectId || null,
        messageId: fallbackAtt.messageId || null,
        project: null as any,
        message: null as any,
      };
    }

    // 2. Strict Access Control Verification
    const isUploader = attachment.uploaderId === userId;
    let isAuthorized = isUploader;

    // Check project membership if project file
    if (!isAuthorized && attachment.projectId) {
      const permCheck = await checkProjectPermission(userId, attachment.projectId);
      if (permCheck.authorized) {
        isAuthorized = true;
      }
    }

    // Check conversation membership if message attachment
    if (!isAuthorized && attachment.message?.conversation) {
      const isConvMember = attachment.message.conversation.members.some(
        (m: { userId: string }) => m.userId === userId
      );
      if (isConvMember) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to download this file' },
        { status: 403 }
      );
    }

    // 3. Generate time-limited secure download URL from Backblaze B2 (5 minutes expiry)
    const downloadUrl = await generateDownloadUrl(
      attachment.storageKey,
      attachment.fileName,
      300
    );

    // If Backblaze B2 is live, issue 302 redirect directly to presigned URL
    if (isB2Configured() && downloadUrl.startsWith('http')) {
      return NextResponse.redirect(downloadUrl, 302);
    }

    // Local Development Fallback: stream local binary directly if present on disk
    const localBuffer = readLocalFallbackFile(attachment.storageKey);
    if (localBuffer) {
      return new NextResponse(new Uint8Array(localBuffer), {
        headers: {
          'Content-Type': attachment.fileType || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${encodeURIComponent(attachment.fileName)}"`,
          'Content-Length': localBuffer.length.toString(),
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        },
      });
    }

    // If local buffer is not on disk, redirect to download-fallback mock generator
    return NextResponse.redirect(new URL(downloadUrl, request.url), 302);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
