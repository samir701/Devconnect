import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getTasks, createTask, updateTask } from '../src/services/db.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const { projectId } = req.query;
    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId is required' });
    }
    const tasks = await getTasks(projectId);
    return res.status(200).json({ tasks });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.title || !body.projectId) {
      return res.status(400).json({ error: 'Title and projectId are required' });
    }

    const task = await createTask({
      projectId: body.projectId,
      messageId: body.messageId,
      title: body.title,
      description: body.description || '',
      priority: body.priority || 'MEDIUM',
      status: body.status || 'TODO',
      assignedTo: body.assignedTo || 'user_samir',
      createdBy: body.createdBy || 'user_samir',
      dueDate: body.dueDate || 'Today',
    });

    return res.status(201).json({ task });
  }

  if (req.method === 'PATCH') {
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });
    const updated = await updateTask(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Task not found' });
    return res.status(200).json({ task: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
