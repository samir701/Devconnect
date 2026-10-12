import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConversations } from '../src/services/db.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId } = req.query;
  const conversations = await getConversations(typeof userId === 'string' ? userId : 'user_samir');
  return res.status(200).json({ conversations });
}
