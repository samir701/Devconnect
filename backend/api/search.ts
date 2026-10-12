import type { VercelRequest, VercelResponse } from '@vercel/node';
import { searchAll } from '../src/services/db.service';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { q = '', projectId } = req.query;
  const results = await searchAll(
    typeof q === 'string' ? q : '',
    typeof projectId === 'string' ? projectId : undefined
  );
  return res.status(200).json({
    query: q,
    results,
    totalCount:
      results.messages.length +
      results.tasks.length +
      results.bugs.length +
      results.files.length +
      results.users.length,
  });
}
