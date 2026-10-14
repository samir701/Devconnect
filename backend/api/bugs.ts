import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBugs, createBug, updateBug } from '../src/services/db.service';
import { BugStatus } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    const { projectId } = req.query;
    if (!projectId || typeof projectId !== 'string') {
      return res.status(400).json({ error: 'projectId is required' });
    }
    const bugs = await getBugs(projectId);
    return res.status(200).json({ bugs });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.title || !body.projectId) {
      return res.status(400).json({ error: 'Title and projectId are required' });
    }

    const creatorId = (body.createdBy as string) || (req.headers['x-user-id'] as string);
    if (!creatorId) return res.status(401).json({ error: 'Authentication required' });
    const assigneeId = (body.assignedTo as string) || creatorId;

    const bug = await createBug({
      projectId: body.projectId,
      messageId: body.messageId,
      title: body.title,
      description: body.description || '',
      endpoint: body.endpoint || '',
      priority: body.priority || 'HIGH',
      status: body.status || 'OPEN',
      assignedTo: assigneeId,
      createdBy: creatorId,
    });

    return res.status(201).json({ bug });
  }

  if (req.method === 'PATCH') {
    if (!id || typeof id !== 'string') return res.status(400).json({ error: 'id required' });
    const updated = await updateBug(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Bug not found' });
    return res.status(200).json({ bug: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
