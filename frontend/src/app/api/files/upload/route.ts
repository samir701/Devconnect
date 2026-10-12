import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import {
  generateUploadUrl,
  buildStorageKey,
  saveLocalFallbackFile,
  isB2Configured,
  getB2Client,
} from '@/lib/storage/b2';
import { createAttachment, updateAttachment } from '@/lib/db';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request) {
  try {
    const userId = getSessionUserId(request);
    const contentTypeHeader = request.headers.get('content-type') || '';
    const { searchParams } = new URL(request.url);
    const queryStorageKey = searchParams.get('storageKey');

    // Case 1: Binary / raw body upload to queryStorageKey (Used by direct upload fallback)
    if (queryStorageKey && (contentTypeHeader.includes('octet-stream') || !contentTypeHeader.includes('application/json'))) {
      const buffer = Buffer.from(await request.arrayBuffer());
      if (buffer.length > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File size exceeds 25MB limit' }, { status: 400 });
      }

      if (isB2Configured()) {
        const client = getB2Client();
        if (client) {
          const bucket = process.env.B2_BUCKET_NAME || 'zettadev-storage';
          await client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: queryStorageKey,
              Body: buffer,
              ContentType: contentTypeHeader || 'application/octet-stream',
            })
          );
        }
      } else {
        saveLocalFallbackFile(queryStorageKey, buffer);
      }

      return NextResponse.json({
        success: true,
        storageKey: queryStorageKey,
        size: buffer.length,
        message: 'File uploaded successfully',
      });
    }

    // Case 2: Multipart form data upload
    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const projectId = (formData.get('projectId') as string) || undefined;
      const conversationId = (formData.get('conversationId') as string) || undefined;
      const messageId = (formData.get('messageId') as string) || undefined;

      if (!file) {
        return NextResponse.json({ error: 'No file provided in form data' }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File size exceeds 25MB limit' }, { status: 400 });
      }

      if (projectId) {
        const check = await checkProjectPermission(userId, projectId);
        if (!check.authorized) {
          return NextResponse.json({ error: check.error }, { status: check.status });
        }
      }

      const fileName = file.name;
      const mimeType = file.type || 'application/octet-stream';
      const storageKey = projectId
        ? buildStorageKey('project', projectId, fileName)
        : buildStorageKey('conversation', conversationId || 'general', fileName);

      const buffer = Buffer.from(await file.arrayBuffer());

      if (isB2Configured()) {
        const client = getB2Client();
        if (client) {
          const bucket = process.env.B2_BUCKET_NAME || 'zettadev-storage';
          await client.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: storageKey,
              Body: buffer,
              ContentType: mimeType,
            })
          );
        }
      } else {
        saveLocalFallbackFile(storageKey, buffer);
      }

      const attachment = await createAttachment({
        projectId,
        messageId,
        uploaderId: userId,
        fileName,
        fileType: mimeType,
        mimeType,
        fileSize: buffer.length,
        storageProvider: isB2Configured() ? 'backblaze_b2' : 'local_storage',
        storageKey,
        fileUrl: `/api/files/download-fallback?key=${encodeURIComponent(storageKey)}`,
      });

      return NextResponse.json({
        success: true,
        attachment,
        storageKey,
      }, { status: 201 });
    }

    // Case 3: JSON payload -> Delegate to upload-url generation
    const body = await request.json();
    const {
      fileName,
      fileType = 'application/octet-stream',
      fileSize = 0,
      projectId,
      conversationId,
    } = body;

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 25MB limit' }, { status: 400 });
    }

    if (projectId) {
      const check = await checkProjectPermission(userId, projectId);
      if (!check.authorized) {
        return NextResponse.json({ error: check.error }, { status: check.status });
      }
    }

    const storageKey = projectId
      ? buildStorageKey('project', projectId, fileName)
      : buildStorageKey('conversation', conversationId || 'general', fileName);

    const presign = await generateUploadUrl(storageKey, fileType, 3600);

    const attachment = await createAttachment({
      projectId: projectId || undefined,
      uploaderId: userId,
      fileName,
      fileType,
      mimeType: fileType,
      fileSize,
      storageProvider: presign.isCloudB2 ? 'backblaze_b2' : 'local_storage',
      storageKey,
      fileUrl: `/api/files/download-fallback?key=${encodeURIComponent(storageKey)}`,
    });

    return NextResponse.json({
      uploadUrl: presign.uploadUrl,
      attachmentId: attachment.id,
      storageKey,
      isCloudB2: presign.isCloudB2,
      attachment,
    }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
