// ============================================
// POST /api/multiplayer/answer
// ============================================
// Submit an answer in a multiplayer game.
// Uses the atomic submitMultiplayerAnswer to avoid race conditions
// when multiple players answer simultaneously.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { submitMultiplayerAnswer } from '../_lib/sessionService';
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
    if (typeof selectedIndex !== 'number' || selectedIndex < -1 || selectedIndex > 3) {
      return res.status(400).json({ error: 'selectedIndex must be -1 to 3' });
    }
    if (typeof timeRemaining !== 'number' || timeRemaining < 0) {
      return res.status(400).json({ error: 'timeRemaining must be >= 0' });
    }

    // Single atomic operation: submit + check all answered + gather standings
    const result = submitMultiplayerAnswer(
      sessionId,
      playerId,
      questionId,
      selectedIndex,
      timeRemaining
    );

    // Broadcast that this player answered (no score details)
    await publishToSession(sessionId, 'answer_result', {
      playerId,
      playerName: result.playerName,
      answered: true,
    });

    // If all connected players have answered, broadcast standings
    if (result.allAnswered) {
      await publishToSession(sessionId, 'all_answered', {
        standings: result.standings,
        questionResults: result.questionResults,
      });
    }

    // Return standard AnswerResult to the calling player
    return res.status(200).json({
      correct: result.correct,
      correctAnswer: result.correctAnswer,
      pointsEarned: result.pointsEarned,
      totalScore: result.totalScore,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: message });
  }
}
