import { NextResponse } from 'next/server';
import { getUploadPresignedUrl } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const { fileName, projectId = 'general', contentType = 'application/octet-stream' } = await request.json();
    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    const key = `project-files/${projectId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const presignData = await getUploadPresignedUrl(key, contentType);

    return NextResponse.json(presignData);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
