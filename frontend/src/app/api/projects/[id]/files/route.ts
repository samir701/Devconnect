import { NextResponse } from 'next/server';
import { getSessionUserId, checkProjectPermission } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { getAttachments } from '@/lib/db';
import { Attachment } from '@/lib/types';

export function getFileCategory(
  fileName: string,
  mimeType?: string
): 'images' | 'docs' | 'code' | 'archives' | 'other' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (
    ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'bmp', 'ico'].includes(ext) ||
    mimeType?.startsWith('image/')
  ) {
    return 'images';
  }
  if (
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'csv', 'tsv', 'md'].includes(ext) ||
    mimeType?.includes('pdf') ||
    mimeType?.includes('document') ||
    mimeType?.includes('text/plain')
  ) {
    return 'docs';
  }
  if (
    [
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'go',
      'rs',
      'json',
      'yaml',
      'yml',
      'sql',
      'sh',
      'bash',
      'log',
      'css',
      'html',
      'c',
      'cpp',
      'java',
    ].includes(ext) ||
    mimeType?.includes('json') ||
    mimeType?.includes('javascript') ||
    mimeType?.includes('python')
  ) {
    return 'code';
  }
  if (
    ['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext) ||
    mimeType?.includes('zip') ||
    mimeType?.includes('tar') ||
    mimeType?.includes('compressed')
  ) {
    return 'archives';
  }
  return 'other';
}

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await props.params;
    const userId = getSessionUserId(request);
    const { searchParams } = new URL(request.url);

    const categoryFilter = searchParams.get('category') || searchParams.get('filter') || 'all';
    const searchQuery = (searchParams.get('search') || '').toLowerCase().trim();

    // 1. Verify project membership
    const perm = await checkProjectPermission(userId, projectId);
    if (!perm.authorized) {
      return NextResponse.json({ error: perm.error }, { status: perm.status });
    }

    // 2. Fetch project files from TiDB with fallback
    let files: Attachment[] = [];
    try {
      const dbFiles = await prisma.attachment.findMany({
        where: { projectId },
        include: {
          uploader: {
            select: { id: true, name: true, avatarUrl: true, headline: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (dbFiles) {
        files = dbFiles.map((f) => ({
          id: f.id,
          messageId: f.messageId || undefined,
          projectId: f.projectId || undefined,
          uploaderId: f.uploaderId,
          userId: f.uploaderId,
          fileName: f.fileName,
          fileType: f.fileType,
          mimeType: f.fileType,
          fileSize: f.fileSize,
          storageProvider: f.storageProvider,
          storageKey: f.storageKey,
          fileUrl: f.fileUrl || `/api/files/${f.id}/download`,
          createdAt: f.createdAt.toISOString(),
          uploader: f.uploader
            ? {
                id: f.uploader.id,
                name: f.uploader.name,
                email: '',
                avatarUrl: f.uploader.avatarUrl || '',
                title: f.uploader.headline || 'Developer',
                skills: [],
                status: 'AVAILABLE',
              }
            : undefined,
        }));
      }
    } catch {
      // In-memory fallback
    }

    if (files.length === 0) {
      files = await getAttachments(projectId);
    }

    // Calculate category summary counts before filtering
    const categoryCounts = {
      all: files.length,
      images: 0,
      docs: 0,
      code: 0,
      archives: 0,
      other: 0,
    };

    let totalSizeBytes = 0;
    files.forEach((f) => {
      const cat = getFileCategory(f.fileName, f.fileType || f.mimeType);
      categoryCounts[cat]++;
      totalSizeBytes += f.fileSize || 0;
    });

    // Apply category filter
    let filteredFiles = files;
    if (categoryFilter !== 'all') {
      filteredFiles = filteredFiles.filter((f) => {
        const cat = getFileCategory(f.fileName, f.fileType || f.mimeType);
        return cat === categoryFilter;
      });
    }

    // Apply search filter
    if (searchQuery) {
      filteredFiles = filteredFiles.filter((f) =>
        f.fileName.toLowerCase().includes(searchQuery)
      );
    }

    return NextResponse.json({
      files: filteredFiles,
      summary: {
        totalCount: files.length,
        filteredCount: filteredFiles.length,
        totalSizeBytes,
        categories: categoryCounts,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
