import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUsers } from '../../src/services/db.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  const users = await getUsers();
  const user = users.find((u) => u.email.toLowerCase() === (email || '').toLowerCase()) || users[0];

  return res.status(200).json({
    success: true,
    user,
    token: `devconn_jwt_${Date.now()}_${user.id}`,
  });
}
