import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAttachments, createAttachment } from '../src/services/db.service';
import { getStorageStatus, getUploadPresignedUrl } from '../src/services/storage.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { projectId } = req.query;
    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId is required' });
    }
    const attachments = await getAttachments(projectId);
    const storageStatus = getStorageStatus();
    return res.status(200).json({ attachments, storageStatus });
  }

  if (req.method === 'POST') {
    const { action } = req.query;
    const body = req.body || {};

    if (action === 'presign') {
      const { fileName, projectId = 'general', contentType = 'application/octet-stream' } = body;
      if (!fileName) return res.status(400).json({ error: 'fileName is required' });
      const key = `project-files/${projectId}/${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const presign = await getUploadPresignedUrl(key, contentType);
      return res.status(200).json(presign);
    }

    if (!body.fileName || !body.projectId) {
      return res.status(400).json({ error: 'fileName and projectId are required' });
    }

    const attachment = await createAttachment({
      projectId: body.projectId,
      messageId: body.messageId,
      userId: body.userId || 'user_samir',
      fileName: body.fileName,
      mimeType: body.mimeType || 'application/octet-stream',
      fileSize: body.fileSize || 0,
      storageProvider: body.storageProvider || 'BACKBLAZE_B2',
      storageKey: body.storageKey || `project-files/${body.projectId}/${body.fileName}`,
      fileUrl: body.fileUrl || '',
    });

    return res.status(201).json({ attachment });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
