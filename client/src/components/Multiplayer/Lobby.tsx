// ============================================
// Lobby — waiting room before multiplayer game starts
// ============================================

import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import * as apiClient from '../../services/apiClient';
import {
  subscribeToSession,
  unsubscribe,
  type PlayerJoinedEvent,
  type GameStartedEvent,
  type PlayerDisconnectedEvent,
  type HostChangedEvent,
} from '../../services/realtimeClient';
import type { PlayerInfo, GameSettings } from '../../types';
import LoadingSpinner from '../Shared/LoadingSpinner';

interface LocationState {
  playerId: string;
  roomCode: string;
  isHost: boolean;
}

export default function Lobby() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [settings, setSettings] = useState<GameSettings | null>(null);
  const [isHost, setIsHost] = useState(state?.isHost ?? false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');

  const playerId = state?.playerId ?? '';
  const roomCode = state?.roomCode ?? '';

  // Guard: no state
  if (!state || !sessionId) {
    return (
      <div className="page-center">
        <h2>Lobby not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/multiplayer')}>
          Back to Multiplayer
        </button>
      </div>
    );
  }

  // Fetch initial lobby state and subscribe to events
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const lobby = await apiClient.getLobby(sessionId!);
        if (cancelled) return;

        setPlayers(lobby.players);
        setSettings(lobby.settings);

        // If game already started (e.g. page refresh), navigate to play
        if (lobby.status === 'active') {
          navigate(`/multiplayer/play/${sessionId}`, {
            replace: true,
            state: { playerId, isHost, fromLobby: true },
          });
          return;
        }

        // Subscribe to realtime events
        await subscribeToSession(sessionId!, {
          onPlayerJoined: (data: PlayerJoinedEvent) => {
            setPlayers(data.players);
          },
          onGameStarted: (data: GameStartedEvent) => {
            navigate(`/multiplayer/play/${sessionId}`, {
              replace: true,
              state: {
                playerId,
                isHost,
                question: data.question,
                questionIndex: data.questionIndex,
                totalQuestions: data.totalQuestions,
                settings: lobby.settings,
                fromLobby: true,
              },
            });
          },
          onPlayerDisconnected: (data: PlayerDisconnectedEvent) => {
            setPlayers(data.players);
          },
          onHostChanged: (data: HostChangedEvent) => {
            setPlayers(data.players);
            if (data.newHostId === playerId) {
              setIsHost(true);
            }
          },
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load lobby');
        }
      }
    }

    init();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId]);

  async function handleStart() {
    if (!sessionId || isStarting) return;
    setIsStarting(true);
    setError('');

    try {
      const result = await apiClient.startMultiplayerGame(sessionId, playerId);

      // Host navigates immediately (Ably event handles other players)
      navigate(`/multiplayer/play/${sessionId}`, {
        replace: true,
        state: {
          playerId,
          isHost: true,
          question: result.question,
          questionIndex: result.questionIndex,
          totalQuestions: result.totalQuestions,
          settings,
          fromLobby: true,
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start game');
      setIsStarting(false);
    }
  }

  function handleLeave() {
    unsubscribe();
    navigate('/multiplayer');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {
      // Fallback: select the text
    }
  }

  if (!settings) {
    return (
      <div className="page-center">
        {error ? (
          <>
            <p className="error-text">{error}</p>
            <button className="btn btn-primary" onClick={() => navigate('/multiplayer')}>
              Back
            </button>
          </>
        ) : (
          <LoadingSpinner />
        )}
      </div>
    );
  }

  const connectedPlayers = players.filter((p) => p.connected);

  return (
    <div className="page-center">
      <div className="card lobby-card">
        <h2>Waiting for Players</h2>

        <div className="room-code-display">
          <span className="room-code-label">Room Code</span>
          <div className="room-code-value" onClick={handleCopy}>
            <span>{roomCode}</span>
          </div>
        </div>

        <div className="lobby-player-count">
          Players: {connectedPlayers.length} / 20
        </div>

        <ul className="lobby-player-list">
          {players.filter((p) => p.connected).map((p) => (
            <li key={p.playerId} className={`lobby-player ${p.playerId === playerId ? 'current-player' : ''}`}>
              <span className="lobby-player-name">{p.name}</span>
              {p.isHost && <span className="host-badge">Host</span>}
            </li>
          ))}
        </ul>

        {error && <p className="error-text">{error}</p>}

        {isHost ? (
          <div className="lobby-actions">
            <button
              className="btn btn-primary full-width"
              onClick={handleStart}
              disabled={connectedPlayers.length < 2 || isStarting}
            >
              {isStarting ? 'Starting…' : 'Start Game'}
            </button>
            {connectedPlayers.length < 2 && (
              <p className="hint-text">Need at least 2 players to start</p>
            )}
          </div>
        ) : (
          <p className="hint-text">Waiting for host to start…</p>
        )}

        <button className="btn btn-secondary full-width" onClick={handleLeave}>
          Leave
        </button>
      </div>
    </div>
  );
}
