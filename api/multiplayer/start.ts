// ============================================
// POST /api/multiplayer/start
// ============================================
// Host starts the multiplayer game.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { startGame } from '../_lib/sessionService';
import { publishToSession } from '../_lib/ablyService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, playerId } = req.body ?? {};

    // --- Validation ---
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    if (!playerId || typeof playerId !== 'string') {
      return res.status(400).json({ error: 'playerId is required' });
    }

    const result = await startGame(sessionId, playerId);

    // Broadcast to all players
    await publishToSession(sessionId, 'game_started', result);

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    if (message.includes('Only the host') || message.includes('Need at least')) {
      return res.status(403).json({ error: message });
    }
    return res.status(400).json({ error: message });
  }
}
