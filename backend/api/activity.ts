import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getActivity } from '../src/services/db.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { projectId } = req.query;
  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ error: 'projectId is required' });
  }

  const activity = await getActivity(projectId);
  return res.status(200).json({ activity });
}
