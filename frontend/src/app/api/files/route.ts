import { NextResponse } from 'next/server';
import { getAttachments, createAttachment } from '@/lib/db';
import { getStorageStatus } from '@/lib/storage';
import { getSessionUserId } from '@/lib/auth-guard';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const attachments = await getAttachments(projectId);
  const status = getStorageStatus();
  return NextResponse.json({ attachments, storageStatus: status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.fileName || !body.projectId) {
      return NextResponse.json({ error: 'fileName and projectId are required' }, { status: 400 });
    }

    const sessionUserId = getSessionUserId(request);
    const userId = body.userId || sessionUserId;
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const attachment = await createAttachment({
      projectId: body.projectId,
      messageId: body.messageId,
      userId,
      fileName: body.fileName,
      mimeType: body.mimeType || 'application/octet-stream',
      fileSize: body.fileSize || 0,
      storageProvider: body.storageProvider || 'BACKBLAZE_B2',
      storageKey: body.storageKey || `project-files/${body.projectId}/${body.fileName}`,
      fileUrl: body.fileUrl || '',
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
