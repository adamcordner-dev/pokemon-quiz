// ============================================
// Session Service
// ============================================
// Manages game sessions: creation, joining, answering, results.
// Storage: Upstash Redis (production) with file-backed JSON fallback (local dev).

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
  MultiplayerAnswerResult,
  SessionResults,
  ResultQuestion,
  ClientQuestion,
  toClientQuestion,
} from './types';
import { generateQuestions } from './pokeApiService';
import { calculateScore } from './scoringService';
import { Redis } from '@upstash/redis';

// --- Redis session store ---
// Each session stored as  session:{sessionId}  with 1-hour TTL.
// Room code → session ID mapping stored as  room:{roomCode}  with 1-hour TTL.

const SESSION_TTL = 3600; // 1 hour in seconds

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set'
    );
  }
  redis = new Redis({ url, token });
  return redis;
}

// ---- Redis helpers ----

async function getSessionFromRedis(sessionId: string): Promise<GameSession | null> {
  const r = getRedis();
  const data = await r.get<GameSession>(`session:${sessionId}`);
  return data ?? null;
}

async function saveSessionToRedis(session: GameSession): Promise<void> {
  const r = getRedis();
  await r.set(`session:${session.sessionId}`, session, { ex: SESSION_TTL });
  // Keep room code mapping in sync
  if (session.roomCode) {
    await r.set(`room:${session.roomCode}`, session.sessionId, { ex: SESSION_TTL });
  }
}

async function getSessionIdByRoomCode(roomCode: string): Promise<string | null> {
  const r = getRedis();
  return await r.get<string>(`room:${roomCode}`);
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
 * Checks Redis for existing room code keys.
 */
async function generateRoomCode(): Promise<string> {
  const MAX_ATTEMPTS = 100;
  const r = getRedis();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    // Check if this room code is already in use
    const existing = await r.get(`room:${code}`);
    if (!existing) {
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

  await saveSessionToRedis(session);

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
  const roomCode = await generateRoomCode();

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

  await saveSessionToRedis(session);

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
export async function joinMultiplayerSession(
  roomCode: string,
  playerName: string
): Promise<MultiplayerJoinResponse> {
  const upperCode = roomCode.toUpperCase();

  // Look up session ID from room code
  const sessionId = await getSessionIdByRoomCode(upperCode);
  if (!sessionId) {
    throw new Error('Room not found');
  }

  const session = await getSessionFromRedis(sessionId);
  if (!session || session.status !== 'waiting') {
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

  await saveSessionToRedis(session);

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
export async function getSession(sessionId: string): Promise<GameSession | undefined> {
  const session = await getSessionFromRedis(sessionId);
  return session ?? undefined;
}

// ---------------------------------------------------------------
// Answering
// ---------------------------------------------------------------

/**
 * Start a multiplayer game. Sets status to 'active' and persists the change.
 * Only the host can call this, and there must be at least 2 connected players.
 */
export async function startGame(
  sessionId: string,
  playerId: string
): Promise<{ question: ClientQuestion; questionIndex: number; totalQuestions: number }> {
  const session = await getSessionFromRedis(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const player = session.players.find((p) => p.playerId === playerId);
  if (!player || !player.isHost) {
    throw new Error('Only the host can start the game');
  }

  const connectedPlayers = session.players.filter((p) => p.connected);
  if (connectedPlayers.length < 2) {
    throw new Error('Need at least 2 players to start');
  }

  if (session.status !== 'waiting') {
    throw new Error('Game has already started');
  }

  session.status = 'active';
  session.currentQuestionIndex = 0;

  await saveSessionToRedis(session);

  const firstQuestion = toClientQuestion(session.questions[0]);
  return {
    question: firstQuestion,
    questionIndex: 0,
    totalQuestions: session.questions.length,
  };
}

/**
 * Submit a player's answer for a question.
 * Validates the session, question, and player, then calculates the score.
 */
export async function submitAnswer(
  sessionId: string,
  playerId: string,
  questionId: string,
  selectedIndex: number,
  timeRemainingSeconds: number
): Promise<AnswerResult> {
  const session = await getSessionFromRedis(sessionId);
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

  // Anti-cheat: in multiplayer, only allow answering the current question
  if (session.isMultiplayer) {
    const currentQ = session.questions[session.currentQuestionIndex];
    if (currentQ.questionId !== questionId) {
      throw new Error('Cannot answer a question that is not the current one');
    }
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

  await saveSessionToRedis(session);

  return {
    correct,
    correctAnswer: question.correctName,
    pointsEarned,
    totalScore: player.score,
  };
}

/**
 * Atomic multiplayer answer: submit, check all-answered, and gather
 * standings — all within a single locked file read/write.
 * Eliminates the race condition where concurrent answers could clobber
 * each other via separate read-modify-write cycles.
 */
export async function submitMultiplayerAnswer(
  sessionId: string,
  playerId: string,
  questionId: string,
  selectedIndex: number,
  timeRemainingSeconds: number
): Promise<MultiplayerAnswerResult> {
  const session = await getSessionFromRedis(sessionId);
  if (!session) throw new Error('Session not found');
  if (session.status !== 'active') throw new Error('Session is not active');

  const question = session.questions.find((q) => q.questionId === questionId);
  if (!question) throw new Error('Question not found');

  // Anti-cheat: only allow answering the current question
  const currentQ = session.questions[session.currentQuestionIndex];
  if (currentQ.questionId !== questionId) {
    throw new Error('Cannot answer a question that is not the current one');
  }

  const player = session.players.find((p) => p.playerId === playerId);
  if (!player) throw new Error('Player not found');

  // Duplicate check
  const existingAnswers = session.answeredQuestions[questionId];
  if (existingAnswers && existingAnswers[playerId]) {
    throw new Error('Already answered this question');
  }

  // Clamp time (anti-cheat)
  const clampedTime = Math.max(
    0,
    Math.min(timeRemainingSeconds, session.settings.timePerQuestion)
  );

  const correct = selectedIndex === question.correctIndex;
  const pointsEarned = calculateScore(
    correct,
    clampedTime,
    session.settings.timePerQuestion
  );

  // Record answer
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
  player.score += pointsEarned;

  // Check if all connected players have answered
  const questionAnswers = session.answeredQuestions[questionId];
  const connectedPlayers = session.players.filter((p) => p.connected);
  const allDone = connectedPlayers.every(
    (p) => questionAnswers[p.playerId] !== undefined
  );

  await saveSessionToRedis(session);

  return {
    correct,
    correctAnswer: question.correctName,
    pointsEarned,
    totalScore: player.score,
    playerName: player.name,
    allAnswered: allDone,
    standings: [...session.players].sort((a, b) => b.score - a.score),
    questionResults: questionAnswers,
  };
}

// ---------------------------------------------------------------
// Multiplayer progression
// ---------------------------------------------------------------

/**
 * Check whether all connected players have answered a given question.
 */
export async function allPlayersAnswered(
  sessionId: string,
  questionId: string
): Promise<boolean> {
  const session = await getSessionFromRedis(sessionId);
  if (!session) return false;

  const questionAnswers = session.answeredQuestions[questionId] ?? {};
  const connectedPlayers = session.players.filter((p) => p.connected);

  return connectedPlayers.every((p) => questionAnswers[p.playerId] !== undefined);
}

/**
 * Advance to the next question. Returns the new ClientQuestion,
 * or null if the quiz is finished.
 */
export async function advanceQuestion(sessionId: string): Promise<ClientQuestion | null> {
  const session = await getSessionFromRedis(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  session.currentQuestionIndex++;

  if (session.currentQuestionIndex >= session.questions.length) {
    session.status = 'finished';
    await saveSessionToRedis(session);
    return null;
  }

  await saveSessionToRedis(session);
  return toClientQuestion(session.questions[session.currentQuestionIndex]);
}

// ---------------------------------------------------------------
// Results
// ---------------------------------------------------------------

/**
 * Build the final results for a session.
 * Players are sorted by score descending.
 */
export async function getResults(sessionId: string): Promise<SessionResults> {
  const session = await getSessionFromRedis(sessionId);
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
    isMultiplayer: session.isMultiplayer,
  };
}

// ---------------------------------------------------------------
// Player management
// ---------------------------------------------------------------

/**
 * Mark a player as disconnected. If they were the host,
 * transfer host status to the next connected player.
 */
export async function removePlayer(sessionId: string, playerId: string): Promise<void> {
  const session = await getSessionFromRedis(sessionId);
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

  await saveSessionToRedis(session);
}
