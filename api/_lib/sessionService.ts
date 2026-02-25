// ============================================
// Session Service
// ============================================
// Manages game sessions: creation, joining, answering, results.
// TODO: Replace with Upstash Redis for production (Phase 15).

import crypto from 'crypto';
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

// --- In-memory session store ---
const sessions = new Map<string, GameSession>();

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
function generateRoomCode(): string {
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

  sessions.set(sessionId, session);

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
  const roomCode = generateRoomCode();

  const session: GameSession = {
    sessionId,
    questions,
    currentQuestionIndex: 0,
    players: [player],
    status: 'waiting',
    roomCode,
    isMultiplayer: true,
    settings,
    answeredQuestions: {},
    createdAt: Date.now(),
  };

  sessions.set(sessionId, session);

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
}

// ---------------------------------------------------------------
// Session lookup
// ---------------------------------------------------------------

/**
 * Retrieve a session by its ID.
 */
export function getSession(sessionId: string): GameSession | undefined {
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
}

// ---------------------------------------------------------------
// Results
// ---------------------------------------------------------------

/**
 * Build the final results for a session.
 * Players are sorted by score descending.
 */
export function getResults(sessionId: string): SessionResults {
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
}
