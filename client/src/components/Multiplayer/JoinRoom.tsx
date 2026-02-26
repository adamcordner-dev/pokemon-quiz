// ============================================
// Join Room — enter room code and join
// ============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as apiClient from '../../services/apiClient';
import BackButton from '../Shared/BackButton';
import { MAX_PLAYER_NAME_LENGTH, ROOM_CODE_LENGTH } from '../../constants';

// Same alphabet as server (excludes confusable chars: I, O, 0, 1)
const ROOM_CODE_REGEX = /^[A-HJ-NP-Z2-9]*$/;

export default function JoinRoom() {
  const navigate = useNavigate();

  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canJoin =
    playerName.trim().length > 0 &&
    roomCode.length === ROOM_CODE_LENGTH &&
    !isLoading;

  function handleRoomCodeChange(value: string) {
    const upper = value.toUpperCase().slice(0, ROOM_CODE_LENGTH);
    // Only allow valid room code characters
    if (ROOM_CODE_REGEX.test(upper)) {
      setRoomCode(upper);
    }
  }

  async function handleJoin() {
    if (!canJoin) return;
    setIsLoading(true);
    setError('');

    try {
      const result = await apiClient.joinRoom(roomCode, playerName.trim());

      navigate(`/multiplayer/lobby/${result.sessionId}`, {
        state: {
          playerId: result.playerId,
          roomCode,
          isHost: false,
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to join room');
      setIsLoading(false);
    }
  }

  return (
    <div className="page-center">
      <div className="card">
        <BackButton to="/multiplayer" />
        <h2>Join Game</h2>

        <div className="form-group">
          <label htmlFor="playerName">Your Name</label>
          <input
            id="playerName"
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, MAX_PLAYER_NAME_LENGTH))}
            placeholder="Enter your name"
            maxLength={MAX_PLAYER_NAME_LENGTH}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="roomCode">Room Code</label>
          <input
            id="roomCode"
            type="text"
            value={roomCode}
            onChange={(e) => handleRoomCodeChange(e.target.value)}
            placeholder="ABCD"
            className="room-code-input"
            maxLength={ROOM_CODE_LENGTH}
          />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button
          className="btn btn-primary full-width"
          onClick={handleJoin}
          disabled={!canJoin}
        >
          {isLoading ? 'Joining…' : 'Join Game'}
        </button>
      </div>
    </div>
  );
}
