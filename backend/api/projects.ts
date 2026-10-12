import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getProjects,
  createProject,
  getProjectById,
  getProjectMembers,
  getTasks,
  getBugs,
  getAttachments,
  getActivity,
} from '../src/services/db.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (req.method === 'GET') {
    if (id && typeof id === 'string') {
      const project = await getProjectById(id);
      if (!project) return res.status(404).json({ error: 'Project not found' });

      const [members, tasks, bugs, attachments, activity] = await Promise.all([
        getProjectMembers(id),
        getTasks(id),
        getBugs(id),
        getAttachments(id),
        getActivity(id),
      ]);

      return res.status(200).json({ project, members, tasks, bugs, attachments, activity });
    }

    const projects = await getProjects();
    return res.status(200).json({ projects });
  }

  if (req.method === 'POST') {
    const { name, description, ownerId, githubRepo } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Project name is required' });

    const project = await createProject({
      name,
      description: description || '',
      ownerId: ownerId || 'user_samir',
      githubRepo: githubRepo || '',
      status: 'ACTIVE',
      channels: ['general', 'development', 'bugs', 'tasks', 'files', 'activity'],
    });

    return res.status(201).json({ project });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
