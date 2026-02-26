// ============================================
// Host Setup — create a multiplayer room
// ============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as apiClient from '../../services/apiClient';
import BackButton from '../Shared/BackButton';
import LoadingSpinner from '../Shared/LoadingSpinner';
import {
  DEFAULT_QUESTION_COUNT,
  MIN_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
  DEFAULT_TIME_PER_QUESTION,
  MIN_TIME_PER_QUESTION,
  MAX_TIME_PER_QUESTION,
  MAX_PLAYER_NAME_LENGTH,
} from '../../constants';

export default function HostSetup() {
  const navigate = useNavigate();

  const [playerName, setPlayerName] = useState('');
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const [timePerQuestion, setTimePerQuestion] = useState(DEFAULT_TIME_PER_QUESTION);
  const [hardMode, setHardMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canCreate = playerName.trim().length > 0 && !isLoading;

  async function handleCreate() {
    if (!canCreate) return;
    setIsLoading(true);
    setError('');

    try {
      const result = await apiClient.createRoom(
        playerName.trim(),
        questionCount,
        timePerQuestion,
        hardMode
      );

      navigate(`/multiplayer/lobby/${result.sessionId}`, {
        state: {
          playerId: result.playerId,
          roomCode: result.roomCode,
          isHost: true,
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page-center">
        <LoadingSpinner />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          Creating room…
        </p>
      </div>
    );
  }

  return (
    <div className="page-center">
      <div className="card">
        <BackButton to="/multiplayer" />
        <h2>Host Game</h2>

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
          <label htmlFor="questionCount">
            Questions: <strong>{questionCount}</strong>
          </label>
          <input
            id="questionCount"
            type="range"
            min={MIN_QUESTION_COUNT}
            max={MAX_QUESTION_COUNT}
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label htmlFor="timePerQuestion">
            Time per Question: <strong>{timePerQuestion}s</strong>
          </label>
          <input
            id="timePerQuestion"
            type="range"
            min={MIN_TIME_PER_QUESTION}
            max={MAX_TIME_PER_QUESTION}
            value={timePerQuestion}
            onChange={(e) => setTimePerQuestion(Number(e.target.value))}
          />
        </div>

        <div className="form-group checkbox-group">
          <label htmlFor="hardMode">
            <input
              id="hardMode"
              type="checkbox"
              checked={hardMode}
              onChange={(e) => setHardMode(e.target.checked)}
            />
            Hard Mode (Silhouettes)
          </label>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button className="btn btn-primary full-width" onClick={handleCreate} disabled={!canCreate}>
          Create Game
        </button>
      </div>
    </div>
  );
}
