// ============================================
// POST /api/quiz/answer
// ============================================
// Submit an answer for a single-player quiz question.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { submitAnswer } from '../_lib/sessionService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, playerId, questionId, selectedIndex, timeRemaining } =
      req.body ?? {};

    // --- Validation ---
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (!playerId || typeof playerId !== 'string') {
      return res.status(400).json({ error: 'playerId is required' });
    }
    if (!questionId || typeof questionId !== 'string') {
      return res.status(400).json({ error: 'questionId is required' });
    }
    if (typeof selectedIndex !== 'number' || selectedIndex < 0 || selectedIndex > 3) {
      return res.status(400).json({ error: 'selectedIndex must be 0-3' });
    }
    if (typeof timeRemaining !== 'number' || timeRemaining < 0) {
      return res.status(400).json({ error: 'timeRemaining must be >= 0' });
    }

    const result = submitAnswer(
      sessionId,
      playerId,
      questionId,
      selectedIndex,
      timeRemaining
    );

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: message });
  }
}
