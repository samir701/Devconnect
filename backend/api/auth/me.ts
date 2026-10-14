import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserById, updateUser } from '../../src/services/db.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = (req.headers['x-user-id'] as string) || (req.query.userId as string);
  if (!userId) {
    return res.status(200).json({ user: null });
  }

  if (req.method === 'GET') {
    const user = await getUserById(userId);
    if (!user) return res.status(200).json({ user: null });
    return res.status(200).json({ user });
  }

  if (req.method === 'PATCH') {
    const updated = await updateUser(userId, req.body || {});
    return res.status(200).json({ user: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
