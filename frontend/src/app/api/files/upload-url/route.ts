import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import {
  generateUploadUrl,
  buildStorageKey,
  isB2Configured,
} from '@/lib/storage/b2';
import { createAttachment } from '@/lib/db';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB limit for security & free-tier safety

export async function POST(request: Request) {
  try {
    const userId = getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      fileName,
      fileType = 'application/octet-stream',
      fileSize = 0,
      projectId,
      conversationId,
      type = 'project-file',
    } = body;

    if (!fileName || typeof fileName !== 'string') {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    // 1. File size validation
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds the 25MB limit (${(fileSize / (1024 * 1024)).toFixed(1)} MB requested)` },
        { status: 400 }
      );
    }

    // 2. Authorization check
    if (projectId) {
      const permCheck = await checkProjectPermission(userId, projectId);
      if (!permCheck.authorized) {
        return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
      }
    } else if (conversationId) {
      // Verify conversation membership
      try {
        const membership = await prisma.conversationMember.findUnique({
          where: {
            conversationId_userId: { conversationId, userId },
          },
        });
        if (!membership) {
          const conv = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { project: { include: { members: true } } },
          });
          const isProjectMember =
            conv?.project?.ownerId === userId ||
            conv?.project?.members.some((m) => m.userId === userId);
          if (!isProjectMember && conv?.type === 'DIRECT') {
            return NextResponse.json(
              { error: 'Forbidden: You are not a participant in this conversation' },
              { status: 403 }
            );
          }
        }
      } catch {
        // Continue if database check is unavailable in local dev
      }
    }

    // 3. Build suggested bucket storage key:
    // zettadev/project-files/{projectId}/{storageKey}
    // zettadev/attachments/{conversationId}/{storageKey}
    let storageKey: string;
    if (projectId) {
      storageKey = buildStorageKey('project', projectId, fileName);
    } else if (conversationId) {
      storageKey = buildStorageKey('conversation', conversationId, fileName);
    } else {
      storageKey = buildStorageKey('avatar', userId, fileName);
    }

    // 4. Generate Pre-signed PutObject URL (or local development fallback endpoint)
    const presign = await generateUploadUrl(storageKey, fileType, 3600);

    // 5. Reserve attachment metadata in TiDB
    const storageProvider = presign.isCloudB2 ? 'backblaze_b2' : 'local_storage';
    const attachment = await createAttachment({
      projectId: projectId || undefined,
      uploaderId: userId,
      fileName,
      fileType,
      mimeType: fileType,
      fileSize,
      storageProvider,
      storageKey,
      fileUrl: `/api/files/download-fallback?key=${encodeURIComponent(storageKey)}`,
    });

    return NextResponse.json({
      uploadUrl: presign.uploadUrl,
      attachmentId: attachment.id,
      storageKey,
      isCloudB2: presign.isCloudB2,
      bucket: presign.bucket,
      expiresIn: presign.expiresIn,
      headers: presign.headers,
      attachment,
    }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
