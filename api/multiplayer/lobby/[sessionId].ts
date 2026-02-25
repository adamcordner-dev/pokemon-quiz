// ============================================
// GET /api/multiplayer/lobby/[sessionId]
// ============================================
// Get the current lobby state for a multiplayer session.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession } from '../../_lib/sessionService';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.status(200).json({
      roomCode: session.roomCode,
      players: session.players,
      settings: session.settings,
      status: session.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
