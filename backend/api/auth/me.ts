import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserById, updateUser } from '../../src/services/db.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const user = await getUserById('user_samir');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.status(200).json({ user });
  }

  if (req.method === 'PATCH') {
    const updated = await updateUser('user_samir', req.body || {});
    return res.status(200).json({ user: updated });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
