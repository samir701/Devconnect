import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getMessages,
  createMessage,
  createBug,
  createTask,
  createAttachment,
  toggleMessageReaction,
  deleteMessage,
} from '../src/services/db.service';
import { detectSecrets } from '../src/services/secret.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { projectId, conversationId, channel } = req.query;
    const messages = await getMessages({
      projectId: typeof projectId === 'string' ? projectId : undefined,
      conversationId: typeof conversationId === 'string' ? conversationId : undefined,
      channel: typeof channel === 'string' ? channel : undefined,
    });
    return res.status(200).json({ messages });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { messageId, reaction, deleteId } = req.query;

    if (deleteId && typeof deleteId === 'string') {
      const ok = await deleteMessage(deleteId);
      return ok ? res.status(200).json({ success: true }) : res.status(404).json({ error: 'Not found' });
    }

    if (messageId && reaction && typeof messageId === 'string' && typeof reaction === 'string') {
      const updated = await toggleMessageReaction(messageId, body.userId || 'user_samir', reaction);
      return res.status(200).json({ message: updated });
    }

    const secretCheck = detectSecrets(body.content || '');
    let bugData = body.bugData;
    let taskData = body.taskData;
    const attachmentData = body.attachmentData;

    if (body.messageType === 'BUG' && bugData && body.projectId) {
      bugData = await createBug({
        projectId: body.projectId,
        title: bugData.title || 'Untitled Bug',
        description: bugData.description || body.content,
        endpoint: bugData.endpoint,
        priority: bugData.priority || 'HIGH',
        status: bugData.status || 'OPEN',
        assignedTo: bugData.assignedTo,
        createdBy: body.senderId || 'user_samir',
      });
    }

    if (body.messageType === 'TASK' && taskData && body.projectId) {
      taskData = await createTask({
        projectId: body.projectId,
        title: taskData.title || 'Untitled Task',
        description: taskData.description || body.content,
        priority: taskData.priority || 'MEDIUM',
        status: taskData.status || 'TODO',
        assignedTo: taskData.assignedTo,
        createdBy: body.senderId || 'user_samir',
        dueDate: taskData.dueDate || 'Today',
      });
    }

    if (body.messageType === 'FILE' && attachmentData && body.projectId) {
      await createAttachment({
        projectId: body.projectId,
        userId: body.senderId || 'user_samir',
        fileName: attachmentData.fileName,
        mimeType: attachmentData.mimeType,
        fileSize: attachmentData.fileSize,
        storageProvider: attachmentData.storageProvider || 'BACKBLAZE_B2',
        storageKey: attachmentData.storageKey || `project-files/${body.projectId}/${attachmentData.fileName}`,
        fileUrl: attachmentData.fileUrl,
      });
    }

    const message = await createMessage({
      projectId: body.projectId,
      conversationId: body.conversationId,
      channel: body.channel || 'general',
      senderId: body.senderId || 'user_samir',
      messageType: body.messageType || 'TEXT',
      content: body.content,
      codeLanguage: body.codeLanguage,
      codeFilename: body.codeFilename,
      bugData,
      taskData,
      attachmentData,
      replyToMessageId: body.replyToMessageId,
      replyToMessage: body.replyToMessage,
      isPinned: false,
    });

    return res.status(201).json({
      message,
      secretDetected: secretCheck.hasSecret ? secretCheck : undefined,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
