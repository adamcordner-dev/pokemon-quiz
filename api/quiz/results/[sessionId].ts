// ============================================
// GET /api/quiz/results/[sessionId]
// ============================================
// Retrieve final results for a quiz session.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getResults } from '../../_lib/sessionService';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const results = getResults(sessionId);
    return res.status(200).json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: message });
  }
}
