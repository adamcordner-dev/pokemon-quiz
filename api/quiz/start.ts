// ============================================
// POST /api/quiz/start
// ============================================
// Creates a new single-player quiz session.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSinglePlayerSession } from '../_lib/sessionService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { playerName, questionCount, timePerQuestion, hardMode } = req.body ?? {};

    // --- Validation ---
    if (typeof playerName !== 'string' || playerName.trim().length === 0) {
      return res.status(400).json({ error: 'playerName is required (1-35 characters)' });
    }
    if (playerName.trim().length > 35) {
      return res.status(400).json({ error: 'playerName must be 35 characters or fewer' });
    }

    const qCount = questionCount ?? 10;
    if (typeof qCount !== 'number' || qCount < 5 || qCount > 20) {
      return res.status(400).json({ error: 'questionCount must be between 5 and 20' });
    }

    const timePQ = timePerQuestion ?? 15;
    if (typeof timePQ !== 'number' || timePQ < 5 || timePQ > 60) {
      return res.status(400).json({ error: 'timePerQuestion must be between 5 and 60' });
    }

    const hard = hardMode ?? false;
    if (typeof hard !== 'boolean') {
      return res.status(400).json({ error: 'hardMode must be a boolean' });
    }

    const result = await createSinglePlayerSession(playerName.trim(), {
      questionCount: qCount,
      timePerQuestion: timePQ,
      hardMode: hard,
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
