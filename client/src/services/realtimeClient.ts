// ============================================
// Realtime Client Service (Ably)
// ============================================
// Manages Ably Realtime subscription for multiplayer sessions.

import * as Ably from 'ably';
import type {
  ClientQuestion,
  PlayerInfo,
  PlayerAnswer,
  SessionResults,
} from '../types';

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
// Client singleton
// ---------------------------------------------------------------

let realtimeClient: Ably.Realtime | null = null;
let currentChannel: Ably.RealtimeChannel | null = null;

function getClient(): Ably.Realtime {
  if (!realtimeClient) {
    realtimeClient = new Ably.Realtime({
      authUrl: '/api/ably-auth',
    });
  }
  return realtimeClient;
}

/**
 * Subscribe to all game events on a session's Ably channel.
 */
export function subscribeToSession(
  sessionId: string,
  handlers: SessionHandlers
): void {
  const client = getClient();
  const channel = client.channels.get(`game:${sessionId}`);
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

/**
 * Detach from the current channel and close the connection.
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
}
