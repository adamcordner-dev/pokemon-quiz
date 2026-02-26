// ============================================
// Single Player Setup
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

export default function SinglePlayerSetup() {
  const navigate = useNavigate();

  const [playerName, setPlayerName] = useState('');
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const [timePerQuestion, setTimePerQuestion] = useState(DEFAULT_TIME_PER_QUESTION);
  const [hardMode, setHardMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const canStart = playerName.trim().length > 0 && !isLoading;

  async function handleStart() {
    if (!canStart) return;
    setIsLoading(true);
    setError('');

    try {
      const result = await apiClient.startQuiz(
        playerName.trim(),
        questionCount,
        timePerQuestion,
        hardMode
      );

      navigate(`/quiz/${result.sessionId}`, {
        state: {
          playerId: result.playerId,
          questions: result.questions,
          settings: result.settings,
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start quiz');
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page-center">
        <LoadingSpinner />
        <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
          Generating questions…
        </p>
      </div>
    );
  }

  return (
    <div className="page-center">
      <div className="card">
        <BackButton to="/" />
        <h2>Solo Quiz</h2>

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

        <button className="btn btn-primary full-width" onClick={handleStart} disabled={!canStart}>
          Start Quiz
        </button>
      </div>
    </div>
  );
}
