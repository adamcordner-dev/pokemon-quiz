// ============================================
// POST /api/multiplayer/join
// ============================================
// Join an existing multiplayer room by room code.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { joinMultiplayerSession } from '../_lib/sessionService';
import { publishToSession } from '../_lib/ablyService';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { roomCode, playerName } = req.body ?? {};

    // --- Validation ---
    if (typeof roomCode !== 'string' || roomCode.trim().length !== 4) {
      return res.status(400).json({ error: 'roomCode must be exactly 4 characters' });
    }
    if (typeof playerName !== 'string' || playerName.trim().length === 0) {
      return res.status(400).json({ error: 'playerName is required (1-35 characters)' });
    }
    if (playerName.trim().length > 35) {
      return res.status(400).json({ error: 'playerName must be 35 characters or fewer' });
    }

    const result = await joinMultiplayerSession(roomCode.trim(), playerName.trim());

    // Notify other players in the room
    await publishToSession(result.sessionId, 'player_joined', {
      players: result.players,
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Room not found') {
      return res.status(404).json({ error: message });
    }
    return res.status(400).json({ error: message });
  }
}
