import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConversations } from '../src/services/db.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
  if (!userId) {
    return res.status(200).json({ conversations: [] });
  }
  const conversations = await getConversations(userId);
  return res.status(200).json({ conversations });
}
