// ============================================
// POST /api/multiplayer/answer
// ============================================
// Submit an answer in a multiplayer game.
// Also checks if all players have answered and broadcasts standings.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  submitAnswer,
  allPlayersAnswered,
  getSession,
} from '../_lib/sessionService';
import { publishToSession } from '../_lib/ablyService';

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

    // Get the player's name for broadcast
    const session = getSession(sessionId)!;
    const player = session.players.find((p) => p.playerId === playerId);

    // Broadcast that this player answered (no score details)
    await publishToSession(sessionId, 'answer_result', {
      playerId,
      playerName: player?.name ?? 'Unknown',
      answered: true,
    });

    // Check if all connected players have answered
    if (allPlayersAnswered(sessionId, questionId)) {
      const questionAnswers = session.answeredQuestions[questionId] ?? {};

      await publishToSession(sessionId, 'all_answered', {
        standings: [...session.players].sort((a, b) => b.score - a.score),
        questionResults: questionAnswers,
      });
    }

    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: message });
  }
}
