// ============================================
// POST /api/multiplayer/start
// ============================================
// Host starts the multiplayer game.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession } from '../_lib/sessionService';
import { toClientQuestion } from '../_lib/types';
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

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify the requester is the host
    const player = session.players.find((p) => p.playerId === playerId);
    if (!player || !player.isHost) {
      return res.status(403).json({ error: 'Only the host can start the game' });
    }

    // Need at least 2 players
    const connectedPlayers = session.players.filter((p) => p.connected);
    if (connectedPlayers.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players to start' });
    }

    if (session.status !== 'waiting') {
      return res.status(400).json({ error: 'Game has already started' });
    }

    // Start the game
    session.status = 'active';
    session.currentQuestionIndex = 0;

    const firstQuestion = toClientQuestion(session.questions[0]);

    // Broadcast to all players
    await publishToSession(sessionId, 'game_started', {
      question: firstQuestion,
      questionIndex: 0,
      totalQuestions: session.questions.length,
    });

    return res.status(200).json({
      question: firstQuestion,
      questionIndex: 0,
      totalQuestions: session.questions.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
