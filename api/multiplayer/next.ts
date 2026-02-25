// ============================================
// POST /api/multiplayer/next
// ============================================
// Host advances to the next question (or finishes the game).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { advanceQuestion, getSession, getResults } from '../_lib/sessionService';
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
      return res.status(403).json({ error: 'Only the host can advance questions' });
    }

    const nextQuestion = advanceQuestion(sessionId);

    if (nextQuestion === null) {
      // Game is over
      const results = getResults(sessionId);
      await publishToSession(sessionId, 'game_over', { results });
      return res.status(200).json({ finished: true, results });
    }

    // Broadcast next question
    await publishToSession(sessionId, 'next_question', {
      question: nextQuestion,
      questionIndex: session.currentQuestionIndex,
    });

    return res.status(200).json({
      finished: false,
      question: nextQuestion,
      questionIndex: session.currentQuestionIndex,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: message });
  }
}
