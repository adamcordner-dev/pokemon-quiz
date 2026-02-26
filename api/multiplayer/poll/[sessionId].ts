// ============================================
// GET /api/multiplayer/poll/[sessionId]
// ============================================
// Returns a comprehensive state snapshot for polling-based
// multiplayer (fallback when Ably is unavailable in local dev).
// The client polls this every ~1 second and diffs against
// the previous response to trigger UI updates.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSession, allPlayersAnswered, getResults } from '../../_lib/sessionService';
import { toClientQuestion, type ClientQuestion, type SessionResults } from '../../_lib/types';

interface PollResponse {
  status: 'waiting' | 'active' | 'finished';
  players: Array<{
    playerId: string;
    name: string;
    score: number;
    connected: boolean;
    isHost: boolean;
  }>;
  // Active-game fields (only when status === 'active')
  currentQuestion?: ClientQuestion;
  questionIndex?: number;
  totalQuestions?: number;
  allAnswered?: boolean;
  standings?: Array<{
    playerId: string;
    name: string;
    score: number;
  }>;
  // Finished-game fields (only when status === 'finished')
  results?: SessionResults;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const session = await getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const response: PollResponse = {
      status: session.status,
      players: session.players.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        score: p.score,
        connected: p.connected,
        isHost: p.isHost,
      })),
    };

    if (session.status === 'active') {
      const currentQ = session.questions[session.currentQuestionIndex];
      const questionId = currentQ.questionId;

      response.currentQuestion = toClientQuestion(currentQ);
      response.questionIndex = session.currentQuestionIndex;
      response.totalQuestions = session.questions.length;
      response.allAnswered = await allPlayersAnswered(sessionId, questionId);
      response.standings = [...session.players]
        .sort((a, b) => b.score - a.score)
        .map((p) => ({
          playerId: p.playerId,
          name: p.name,
          score: p.score,
        }));
    }

    if (session.status === 'finished') {
      response.results = await getResults(sessionId);
    }

    // No-cache headers to prevent stale poll data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.status(200).json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message });
  }
}
