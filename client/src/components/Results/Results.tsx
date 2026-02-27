// ============================================
// Results Screen
// ============================================
// Handles both single-player and multiplayer results.
// Multiplayer shows a podium + all players' standings.

import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import confetti from 'canvas-confetti';
import * as apiClient from '../../services/apiClient';
import type { SessionResults, PlayerInfo } from '../../types';
import LoadingSpinner from '../Shared/LoadingSpinner';
import { useSound } from '../../context/SoundContext';

function fireConfetti() {
  const defaults = { colors: ['#ee1515', '#f1c40f', '#3b4cca', '#ffffff'], ticks: 120 };
  confetti({ ...defaults, angle: 60, spread: 55, origin: { x: 0, y: 1 }, particleCount: 80 });
  confetti({ ...defaults, angle: 120, spread: 55, origin: { x: 1, y: 1 }, particleCount: 80 });
}

// ---------------------------------------------------------------
// Podium (top 3 players)
// ---------------------------------------------------------------

function Podium({ players }: { players: PlayerInfo[] }) {
  // Order: 2nd, 1st, 3rd for classic podium layout
  const first = players[0];
  const second = players[1];
  const third = players[2];

  const podiumSlots = [
    { player: second, place: 2, height: '5rem', medal: '🥈' },
    { player: first, place: 1, height: '7rem', medal: '🥇' },
    { player: third, place: 3, height: '3.5rem', medal: '🥉' },
  ];

  return (
    <div className="podium">
      {podiumSlots.map(({ player, place, height, medal }) =>
        player ? (
          <div key={place} className={`podium-slot podium-${place}`}>
            <span className="podium-medal">{medal}</span>
            <span className="podium-name">{player.name}</span>
            <span className="podium-score">{player.score} pts</span>
            <div className="podium-bar" style={{ height }} />
            <span className="podium-place">{place}</span>
          </div>
        ) : (
          <div key={place} className={`podium-slot podium-${place} podium-empty`}>
            <div className="podium-bar" style={{ height }} />
            <span className="podium-place">{place}</span>
          </div>
        )
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Full standings table
// ---------------------------------------------------------------

function StandingsTable({ players, currentPlayerId }: { players: PlayerInfo[]; currentPlayerId?: string }) {
  return (
    <div className="results-standings">
      {players.map((p, i) => (
        <div key={p.playerId} className={`standings-entry ${p.playerId === currentPlayerId ? 'current-player' : ''}`}>
          <span className="standings-rank">#{i + 1}</span>
          <span className="standings-name">{p.name}{p.playerId === currentPlayerId ? ' (You)' : ''}</span>
          <span className="standings-score">{p.score}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------
// Main Results component
// ---------------------------------------------------------------

export default function Results() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { playVictory, stopVictory } = useSound();

  const statePlayerId = (location.state as { playerId?: string } | null)?.playerId;

  const [results, setResults] = useState<SessionResults | null>(null);
  const [error, setError] = useState('');
  const didLoad = useRef(false);

  useEffect(() => {
    if (!sessionId || didLoad.current) return;
    didLoad.current = true;

    apiClient
      .getResults(sessionId)
      .then((data) => {
        setResults(data);
        playVictory();
        fireConfetti();
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load results');
      });
  }, [sessionId, playVictory]);

  // Separate cleanup effect — always registers stopVictory on unmount
  useEffect(() => {
    return () => { stopVictory(); };
  }, [stopVictory]);

  if (error) {
    return (
      <div className="page-center">
        <h2>Error</h2>
        <p className="error-text">{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Go Home
        </button>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="page-center">
        <LoadingSpinner />
      </div>
    );
  }

  const isMultiplayer = results.isMultiplayer;

  // Determine "me" — use state playerId, else fall back to first player (single-player)
  const myPlayerId = statePlayerId ?? results.players[0]?.playerId;
  const myPlayer = results.players.find((p) => p.playerId === myPlayerId) ?? results.players[0];

  const totalPossible = results.settings.questionCount * 400;
  const myPercentage = totalPossible > 0 ? Math.round((myPlayer.score / totalPossible) * 100) : 0;
  const myCorrectCount = results.questions.filter((q) => {
    const answer = q.playerAnswers[myPlayer.playerId];
    return answer?.correct;
  }).length;

  // Average answer time (timePerQuestion − timeRemaining)
  const myAnswers = results.questions
    .map((q) => q.playerAnswers[myPlayer.playerId])
    .filter((a): a is NonNullable<typeof a> => a != null && a.selectedIndex !== -1);
  const avgAnswerTime =
    myAnswers.length > 0
      ? (myAnswers.reduce((sum, a) => sum + (results.settings.timePerQuestion - a.timeRemaining), 0) / myAnswers.length).toFixed(1)
      : '—';

  // My rank in multiplayer
  const myRank = results.players.findIndex((p) => p.playerId === myPlayer.playerId) + 1;

  function handlePlayAgain() {
    stopVictory();
    if (isMultiplayer) {
      navigate('/multiplayer');
    } else {
      navigate('/single-player');
    }
  }

  function handleHome() {
    stopVictory();
    navigate('/');
  }

  return (
    <div className="page-center">
      <div className={`card results-card ${isMultiplayer ? 'results-card--mp' : ''}`}>
        <h2>{isMultiplayer ? 'Game Over!' : 'Quiz Complete!'}</h2>

        {/* --- Multiplayer podium --- */}
        {isMultiplayer && results.players.length >= 2 && (
          <Podium players={results.players} />
        )}

        {/* --- Your personal summary --- */}
        <div className="results-summary">
          {isMultiplayer && (
            <p className="results-rank-label">
              You finished <strong>#{myRank}</strong> of {results.players.length}
            </p>
          )}
          <div className="results-score">
            <span className="score-value big">{myPlayer.score}</span>
            <span className="score-label">points</span>
          </div>
          <div className="results-stats">
            <p>
              {myCorrectCount} / {results.questions.length} correct ({myPercentage}%)
            </p>
            <p>Avg answer time: {avgAnswerTime}s</p>
          </div>
        </div>

        {/* --- Full standings (multiplayer only) --- */}
        {isMultiplayer && results.players.length >= 2 && (
          <div className="results-all-standings">
            <h3>Final Standings</h3>
            <StandingsTable players={results.players} currentPlayerId={myPlayer.playerId} />
          </div>
        )}

        {/* --- Question breakdown --- */}
        <div className="results-breakdown">
          <h3>Question Breakdown</h3>
          {results.questions.map((q, i) => {
            const myAnswer = q.playerAnswers[myPlayer.playerId];
            const isCorrect = myAnswer?.correct ?? false;
            return (
              <div key={q.questionId} className={`breakdown-row ${isCorrect ? 'correct' : 'incorrect'}`}>
                <span className="breakdown-num">Q{i + 1}</span>
                <img src={q.imageUrl} alt="Pokemon" className="breakdown-img" />
                <span className="breakdown-answer">{q.correctAnswer}</span>
                <span className="breakdown-points">
                  {myAnswer ? `+${myAnswer.pointsEarned}` : '+0'}
                </span>
                {/* In multiplayer, show how many got it right */}
                {isMultiplayer && (
                  <span className="breakdown-mp-stat">
                    {Object.values(q.playerAnswers).filter((a) => a.correct).length}/{results.players.length}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="button-stack" style={{ marginTop: '1.5rem' }}>
          <button className="btn btn-primary" onClick={handlePlayAgain}>
            Play Again
          </button>
          <button className="btn btn-secondary" onClick={handleHome}>
            Home
          </button>
        </div>
        <a
          className="feedback-link"
          href="mailto:pokemonquiz.feedback@gmail.com?subject=Pokemon%20Quiz%20Feedback"
        >
          Send Feedback
        </a>
      </div>
    </div>
  );
}
