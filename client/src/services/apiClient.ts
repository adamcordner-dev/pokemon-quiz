// ============================================
// API Client Service
// ============================================
// All REST calls to the server. Uses relative URLs
// so Vite proxy handles routing in dev.

import type {
  QuizStartResponse,
  AnswerResult,
  SessionResults,
  MultiplayerCreateResponse,
  MultiplayerJoinResponse,
  LobbyState,
  ClientQuestion,
} from '../types';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }

  return data as T;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }

  return data as T;
}

// ---------------------------------------------------------------
// Single Player
// ---------------------------------------------------------------

export function startQuiz(
  playerName: string,
  questionCount: number,
  timePerQuestion: number,
  hardMode: boolean
): Promise<QuizStartResponse> {
  return post('/api/quiz/start', {
    playerName,
    questionCount,
    timePerQuestion,
    hardMode,
  });
}

export function submitAnswer(
  sessionId: string,
  playerId: string,
  questionId: string,
  selectedIndex: number,
  timeRemaining: number
): Promise<AnswerResult> {
  return post('/api/quiz/answer', {
    sessionId,
    playerId,
    questionId,
    selectedIndex,
    timeRemaining,
  });
}

export function getResults(sessionId: string): Promise<SessionResults> {
  return get(`/api/quiz/results/${sessionId}`);
}

// ---------------------------------------------------------------
// Multiplayer
// ---------------------------------------------------------------

export function createRoom(
  playerName: string,
  questionCount: number,
  timePerQuestion: number,
  hardMode: boolean
): Promise<MultiplayerCreateResponse> {
  return post('/api/multiplayer/create', {
    playerName,
    questionCount,
    timePerQuestion,
    hardMode,
  });
}

export function joinRoom(
  roomCode: string,
  playerName: string
): Promise<MultiplayerJoinResponse> {
  return post('/api/multiplayer/join', { roomCode, playerName });
}

export function getLobby(sessionId: string): Promise<LobbyState> {
  return get(`/api/multiplayer/lobby/${sessionId}`);
}

export interface MultiplayerStartResponse {
  question: ClientQuestion;
  questionIndex: number;
  totalQuestions: number;
}

export function startMultiplayerGame(
  sessionId: string,
  playerId: string
): Promise<MultiplayerStartResponse> {
  return post('/api/multiplayer/start', { sessionId, playerId });
}

export function submitMultiplayerAnswer(
  sessionId: string,
  playerId: string,
  questionId: string,
  selectedIndex: number,
  timeRemaining: number
): Promise<AnswerResult> {
  return post('/api/multiplayer/answer', {
    sessionId,
    playerId,
    questionId,
    selectedIndex,
    timeRemaining,
  });
}

export interface NextQuestionResponse {
  finished: boolean;
  question?: ClientQuestion;
  questionIndex?: number;
  results?: import('../types').SessionResults;
}

export function nextQuestion(
  sessionId: string,
  playerId: string
): Promise<NextQuestionResponse> {
  return post('/api/multiplayer/next', { sessionId, playerId });
}
