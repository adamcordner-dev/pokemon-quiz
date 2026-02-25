// ============================================
// Session Service
// ============================================
// Manages game sessions: creation, joining, answering, results.
// TODO: Replace with Upstash Redis for production (Phase 15).

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  GameSession,
  GameSettings,
  PlayerInfo,
  PlayerAnswer,
  QuizStartResponse,
  MultiplayerCreateResponse,
  MultiplayerJoinResponse,
  AnswerResult,
  SessionResults,
  ResultQuestion,
  ClientQuestion,
  toClientQuestion,
} from './types';
import { generateQuestions } from './pokeApiService';
import { calculateScore } from './scoringService';

// --- File-backed session store ---
// Vercel dev bundles each serverless function separately, so an in-memory
// Map is NOT shared between endpoints. Instead we persist sessions to a
// temp JSON file that all functions can read/write.
// TODO: Replace with Upstash Redis for production (Phase 15).

const STORE_PATH = path.join(os.tmpdir(), 'pokemon-quiz-sessions.json');

function loadSessions(): Map<string, GameSession> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      const entries: [string, GameSession][] = JSON.parse(raw);
      return new Map(entries);
    }
  } catch {
    // Corrupted file — start fresh
  }
  return new Map();
}

function saveSessions(sessions: Map<string, GameSession>): void {
  const entries = Array.from(sessions.entries());
  fs.writeFileSync(STORE_PATH, JSON.stringify(entries), 'utf-8');
}

/** Helper: read → mutate → write pattern */
function withSessions<T>(fn: (sessions: Map<string, GameSession>) => T): T {
  const sessions = loadSessions();
  const result = fn(sessions);
  saveSessions(sessions);
  return result;
}

/** Maximum players allowed in a multiplayer room. */
export const MAX_PLAYERS = 20;

/** Characters used for room codes (excludes 0/O, 1/I/L to avoid confusion). */
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

/**
 * Generate a 4-character room code that isn't already in use.
 */
function generateRoomCode(sessions: Map<string, GameSession>): string {
  const MAX_ATTEMPTS = 100;
  const activeCodes = new Set<string>();

  for (const session of sessions.values()) {
    if (session.roomCode && session.status !== 'finished') {
      activeCodes.add(session.roomCode);
    }
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    if (!activeCodes.has(code)) {
      return code;
    }
  }

  throw new Error('Failed to generate a unique room code after 100 attempts.');
}

/**
 * Create a PlayerInfo object.
 */
function createPlayer(name: string, isHost: boolean): PlayerInfo {
  return {
    playerId: crypto.randomUUID(),
    name,
    score: 0,
    connected: true,
    isHost,
  };
}

// ---------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------

/**
 * Create a single-player quiz session.
 * Generates questions, stores the session, and returns client-safe data.
 */
export async function createSinglePlayerSession(
  playerName: string,
  settings: GameSettings
): Promise<QuizStartResponse> {
  const sessionId = crypto.randomUUID();
  const questions = await generateQuestions(settings);
  const player = createPlayer(playerName, true);

  const session: GameSession = {
    sessionId,
    questions,
    currentQuestionIndex: 0,
    players: [player],
    status: 'active',
    roomCode: null,
    isMultiplayer: false,
    settings,
    answeredQuestions: {},
    createdAt: Date.now(),
  };

  withSessions((sessions) => {
    sessions.set(sessionId, session);
  });

  const clientQuestions: ClientQuestion[] = questions.map(toClientQuestion);

  return {
    sessionId,
    playerId: player.playerId,
    questions: clientQuestions,
    settings,
  };
}

/**
 * Create a multiplayer session with a room code.
 * The session starts in 'waiting' status until the host starts it.
 */
export async function createMultiplayerSession(
  playerName: string,
  settings: GameSettings
): Promise<MultiplayerCreateResponse> {
  const sessionId = crypto.randomUUID();
  const questions = await generateQuestions(settings);
  const player = createPlayer(playerName, true);

  const roomCode = withSessions((sessions) => {
    const code = generateRoomCode(sessions);

    const session: GameSession = {
      sessionId,
      questions,
      currentQuestionIndex: 0,
      players: [player],
      status: 'waiting',
      roomCode: code,
      isMultiplayer: true,
      settings,
      answeredQuestions: {},
      createdAt: Date.now(),
    };

    sessions.set(sessionId, session);
    return code;
  });

  return {
    sessionId,
    playerId: player.playerId,
    roomCode,
  };
}

// ---------------------------------------------------------------
// Joining
// ---------------------------------------------------------------

/**
 * Join an existing multiplayer session by room code.
 */
export function joinMultiplayerSession(
  roomCode: string,
  playerName: string
): MultiplayerJoinResponse {
  return withSessions((sessions) => {
    const upperCode = roomCode.toUpperCase();

    let session: GameSession | undefined;
    for (const s of sessions.values()) {
      if (s.roomCode === upperCode && s.status === 'waiting') {
        session = s;
        break;
      }
    }

    if (!session) {
      throw new Error('Room not found');
    }

    if (session.players.length >= MAX_PLAYERS) {
      throw new Error('Room is full (max 20 players)');
    }

    const nameTaken = session.players.some(
      (p) => p.name.toLowerCase() === playerName.toLowerCase()
    );
    if (nameTaken) {
      throw new Error('Name already taken');
    }

    const player = createPlayer(playerName, false);
    session.players.push(player);

    return {
      sessionId: session.sessionId,
      playerId: player.playerId,
      players: session.players,
      settings: session.settings,
    };
  });
}

// ---------------------------------------------------------------
// Session lookup
// ---------------------------------------------------------------

/**
 * Retrieve a session by its ID.
 */
export function getSession(sessionId: string): GameSession | undefined {
  const sessions = loadSessions();
  return sessions.get(sessionId);
}

// ---------------------------------------------------------------
// Answering
// ---------------------------------------------------------------

/**
 * Submit a player's answer for a question.
 * Validates the session, question, and player, then calculates the score.
 */
export function submitAnswer(
  sessionId: string,
  playerId: string,
  questionId: string,
  selectedIndex: number,
  timeRemainingSeconds: number
): AnswerResult {
  return withSessions((sessions) => {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }

    // Find the question
    const question = session.questions.find((q) => q.questionId === questionId);
    if (!question) {
      throw new Error('Question not found');
    }

    // Find the player
    const player = session.players.find((p) => p.playerId === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // Check for duplicate answer
    const questionAnswers = session.answeredQuestions[questionId];
    if (questionAnswers && questionAnswers[playerId]) {
      throw new Error('Already answered this question');
    }

    // Clamp timeRemaining to valid range (anti-cheat)
    const clampedTime = Math.max(
      0,
      Math.min(timeRemainingSeconds, session.settings.timePerQuestion)
    );

    // Determine correctness and calculate score
    const correct = selectedIndex === question.correctIndex;
    const pointsEarned = calculateScore(
      correct,
      clampedTime,
      session.settings.timePerQuestion
    );

    // Record the answer
    const playerAnswer: PlayerAnswer = {
      selectedIndex,
      correct,
      pointsEarned,
      timeRemaining: clampedTime,
    };

    if (!session.answeredQuestions[questionId]) {
      session.answeredQuestions[questionId] = {};
    }
    session.answeredQuestions[questionId][playerId] = playerAnswer;

    // Update player's total score
    player.score += pointsEarned;

    return {
      correct,
      correctAnswer: question.correctName,
      pointsEarned,
      totalScore: player.score,
    };
  });
}

// ---------------------------------------------------------------
// Multiplayer progression
// ---------------------------------------------------------------

/**
 * Check whether all connected players have answered a given question.
 */
export function allPlayersAnswered(
  sessionId: string,
  questionId: string
): boolean {
  const sessions = loadSessions();
  const session = sessions.get(sessionId);
  if (!session) return false;

  const questionAnswers = session.answeredQuestions[questionId] ?? {};
  const connectedPlayers = session.players.filter((p) => p.connected);

  return connectedPlayers.every((p) => questionAnswers[p.playerId] !== undefined);
}

/**
 * Advance to the next question. Returns the new ClientQuestion,
 * or null if the quiz is finished.
 */
export function advanceQuestion(sessionId: string): ClientQuestion | null {
  return withSessions((sessions) => {
    const session = sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.currentQuestionIndex++;

    if (session.currentQuestionIndex >= session.questions.length) {
      session.status = 'finished';
      return null;
    }

    return toClientQuestion(session.questions[session.currentQuestionIndex]);
  });
}

// ---------------------------------------------------------------
// Results
// ---------------------------------------------------------------

/**
 * Build the final results for a session.
 * Players are sorted by score descending.
 */
export function getResults(sessionId: string): SessionResults {
  const sessions = loadSessions();
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Sort players by score (highest first)
  const sortedPlayers = [...session.players].sort(
    (a, b) => b.score - a.score
  );

  // Build per-question breakdown
  const questions: ResultQuestion[] = session.questions.map((q) => ({
    questionId: q.questionId,
    imageUrl: q.imageUrl,
    correctAnswer: q.correctName,
    playerAnswers: session.answeredQuestions[q.questionId] ?? {},
  }));

  return {
    players: sortedPlayers,
    questions,
    settings: session.settings,
  };
}

// ---------------------------------------------------------------
// Player management
// ---------------------------------------------------------------

/**
 * Mark a player as disconnected. If they were the host,
 * transfer host status to the next connected player.
 */
export function removePlayer(sessionId: string, playerId: string): void {
  withSessions((sessions) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    const player = session.players.find((p) => p.playerId === playerId);
    if (!player) return;

    player.connected = false;

    // Transfer host if needed
    if (player.isHost) {
      player.isHost = false;
      const nextHost = session.players.find(
        (p) => p.connected && p.playerId !== playerId
      );
      if (nextHost) {
        nextHost.isHost = true;
      }
    }
  });
}
