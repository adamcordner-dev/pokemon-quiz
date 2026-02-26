// ============================================
// Realtime Client Service (Ably + Polling Fallback)
// ============================================
// Manages real-time multiplayer events.
// Uses Ably when available; falls back to polling /api/multiplayer/poll
// every 1 second when ABLY_API_KEY is not configured (local dev).

import * as Ably from 'ably';
import type {
  ClientQuestion,
  PlayerInfo,
  PlayerAnswer,
  SessionResults,
  PollResponse,
} from '../types';
import { pollSession } from './apiClient';

// ---------------------------------------------------------------
// Event payload types
// ---------------------------------------------------------------

export interface PlayerJoinedEvent {
  players: PlayerInfo[];
}

export interface GameStartedEvent {
  question: ClientQuestion;
  questionIndex: number;
  totalQuestions: number;
}

export interface AnswerResultEvent {
  playerId: string;
  playerName: string;
  answered: true;
}

export interface AllAnsweredEvent {
  standings: PlayerInfo[];
  questionResults: Record<string, PlayerAnswer>;
}

export interface NextQuestionEvent {
  question: ClientQuestion;
  questionIndex: number;
}

export interface GameOverEvent {
  results: SessionResults;
}

export interface PlayerDisconnectedEvent {
  playerId: string;
  players: PlayerInfo[];
}

export interface HostChangedEvent {
  newHostId: string;
  players: PlayerInfo[];
}

export interface SessionHandlers {
  onPlayerJoined?: (data: PlayerJoinedEvent) => void;
  onGameStarted?: (data: GameStartedEvent) => void;
  onAnswerResult?: (data: AnswerResultEvent) => void;
  onAllAnswered?: (data: AllAnsweredEvent) => void;
  onNextQuestion?: (data: NextQuestionEvent) => void;
  onGameOver?: (data: GameOverEvent) => void;
  onPlayerDisconnected?: (data: PlayerDisconnectedEvent) => void;
  onHostChanged?: (data: HostChangedEvent) => void;
}

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------

let realtimeClient: Ably.Realtime | null = null;
let currentChannel: Ably.RealtimeChannel | null = null;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let usePolling = false;

// ---------------------------------------------------------------
// Ably Mode
// ---------------------------------------------------------------

async function initAbly(): Promise<boolean> {
  try {
    // Check if Ably auth is available
    const res = await fetch('/api/ably-auth');
    if (res.status === 501) {
      // Server says Ably not configured — use polling
      return false;
    }
    if (!res.ok) return false;

    realtimeClient = new Ably.Realtime({ authUrl: '/api/ably-auth' });
    return true;
  } catch {
    return false;
  }
}

function subscribeAbly(sessionId: string, handlers: SessionHandlers): void {
  if (!realtimeClient) return;

  const channel = realtimeClient.channels.get(`game:${sessionId}`);
  currentChannel = channel;

  const eventMap: Record<string, ((data: unknown) => void) | undefined> = {
    player_joined: handlers.onPlayerJoined as (data: unknown) => void,
    game_started: handlers.onGameStarted as (data: unknown) => void,
    answer_result: handlers.onAnswerResult as (data: unknown) => void,
    all_answered: handlers.onAllAnswered as (data: unknown) => void,
    next_question: handlers.onNextQuestion as (data: unknown) => void,
    game_over: handlers.onGameOver as (data: unknown) => void,
    player_disconnected: handlers.onPlayerDisconnected as (data: unknown) => void,
    host_changed: handlers.onHostChanged as (data: unknown) => void,
  };

  for (const [event, handler] of Object.entries(eventMap)) {
    if (handler) {
      channel.subscribe(event, (msg: Ably.Message) => {
        handler(msg.data);
      });
    }
  }
}

// ---------------------------------------------------------------
// Polling Mode
// ---------------------------------------------------------------

function startPolling(sessionId: string, handlers: SessionHandlers): void {
  let prev: PollResponse | null = null;

  async function doPoll() {
    try {
      const curr = await pollSession(sessionId);

      if (prev) {
        // Diff and fire handlers

        // Player list changed (join/disconnect)
        if (JSON.stringify(curr.players) !== JSON.stringify(prev.players)) {
          handlers.onPlayerJoined?.({ players: curr.players });

          // Check for host change
          const prevHost = prev.players.find((p) => p.isHost);
          const currHost = curr.players.find((p) => p.isHost);
          if (prevHost && currHost && prevHost.playerId !== currHost.playerId) {
            handlers.onHostChanged?.({
              newHostId: currHost.playerId,
              players: curr.players,
            });
          }

          // Check for disconnected players
          for (const p of prev.players) {
            const match = curr.players.find((c) => c.playerId === p.playerId);
            if (match && p.connected && !match.connected) {
              handlers.onPlayerDisconnected?.({
                playerId: p.playerId,
                players: curr.players,
              });
            }
          }
        }

        // Game started (status changed from waiting to active)
        if (prev.status === 'waiting' && curr.status === 'active' && curr.currentQuestion) {
          handlers.onGameStarted?.({
            question: curr.currentQuestion,
            questionIndex: curr.questionIndex ?? 0,
            totalQuestions: curr.totalQuestions ?? 0,
          });
        }

        // Question advanced
        if (
          prev.status === 'active' &&
          curr.status === 'active' &&
          prev.questionIndex !== undefined &&
          curr.questionIndex !== undefined &&
          curr.questionIndex > prev.questionIndex &&
          curr.currentQuestion
        ) {
          handlers.onNextQuestion?.({
            question: curr.currentQuestion,
            questionIndex: curr.questionIndex,
          });
        }

        // All answered (transition from false → true)
        if (
          curr.status === 'active' &&
          curr.allAnswered &&
          !prev.allAnswered &&
          curr.standings
        ) {
          handlers.onAllAnswered?.({
            standings: curr.players,
            questionResults: {},
          });
        }

        // Game over
        if (prev.status !== 'finished' && curr.status === 'finished' && curr.results) {
          handlers.onGameOver?.({ results: curr.results });
        }
      }

      prev = curr;
    } catch (err) {
      console.error('[Poll] Error:', err);
    }
  }

  // First poll immediately
  doPoll();
  pollIntervalId = setInterval(doPoll, 1000);
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

/**
 * Subscribe to all game events on a session.
 * Tries Ably first; falls back to polling if unavailable.
 */
export async function subscribeToSession(
  sessionId: string,
  handlers: SessionHandlers
): Promise<void> {
  // Clean up any previous subscription
  unsubscribe();

  const ablyAvailable = await initAbly();

  if (ablyAvailable) {
    usePolling = false;
    subscribeAbly(sessionId, handlers);
  } else {
    usePolling = true;
    startPolling(sessionId, handlers);
  }
}

/**
 * Detach from the current channel / stop polling.
 */
export function unsubscribe(): void {
  if (currentChannel) {
    currentChannel.detach();
    currentChannel = null;
  }
  if (realtimeClient) {
    realtimeClient.close();
    realtimeClient = null;
  }
  if (pollIntervalId !== null) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  usePolling = false;
}

/**
 * Whether we're currently using polling instead of Ably.
 */
export function isPollingMode(): boolean {
  return usePolling;
}
