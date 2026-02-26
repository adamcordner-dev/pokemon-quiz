// ============================================
// Quiz Game — main gameplay screen
// ============================================
// Reused for single player AND multiplayer.
// Single player: /quiz/:sessionId with questions in router state.
// Multiplayer: /multiplayer/play/:sessionId with first question in router state.

import { useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuiz } from '../../hooks/useQuiz';
import { useMultiplayer } from '../../hooks/useMultiplayer';
import { useTimer } from '../../hooks/useTimer';
import type { ClientQuestion, GameSettings, PlayerInfo } from '../../types';
import ProgressIndicator from './ProgressIndicator';
import TimerBar from './TimerBar';
import ScoreDisplay from './ScoreDisplay';
import QuestionCard from './QuestionCard';
import Standings from './Standings';
import LoadingSpinner from '../Shared/LoadingSpinner';

// ---------- Single Player state from router ----------
interface SinglePlayerState {
  playerId: string;
  questions: ClientQuestion[];
  settings: GameSettings;
}

// ---------- Multiplayer state from router ----------
interface MultiplayerState {
  playerId: string;
  isHost: boolean;
  question: ClientQuestion;
  questionIndex: number;
  totalQuestions: number;
  settings: GameSettings;
  fromLobby: true;
}

function isMultiplayerState(s: unknown): s is MultiplayerState {
  return typeof s === 'object' && s !== null && 'fromLobby' in s;
}

// =============================================
// Top-level: detect mode, render appropriate inner
// =============================================

export default function QuizGame() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state;

  if (!state || !sessionId) {
    return (
      <div className="page-center">
        <h2>Session not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  if (isMultiplayerState(state)) {
    return (
      <MultiplayerGameInner
        sessionId={sessionId}
        playerId={state.playerId}
        isHost={state.isHost}
        initialQuestion={state.question}
        questionIndex={state.questionIndex}
        totalQuestions={state.totalQuestions}
        settings={state.settings}
      />
    );
  }

  const sp = state as SinglePlayerState;
  return (
    <SinglePlayerGameInner
      sessionId={sessionId}
      playerId={sp.playerId}
      questions={sp.questions}
      settings={sp.settings}
    />
  );
}

// =============================================
// Single Player Inner
// =============================================

interface SinglePlayerInnerProps {
  sessionId: string;
  playerId: string;
  questions: ClientQuestion[];
  settings: GameSettings;
}

function SinglePlayerGameInner({ sessionId, playerId, questions, settings }: SinglePlayerInnerProps) {
  const navigate = useNavigate();
  const quiz = useQuiz({ sessionId, playerId, questions, settings });

  const handleTimerExpire = useCallback(() => {
    quiz.answerQuestion(-1, 0);
  }, [quiz.answerQuestion]);

  const timer = useTimer({
    totalSeconds: settings.timePerQuestion,
    onExpire: handleTimerExpire,
    isPaused: quiz.answered,
  });

  if (quiz.isFinished) {
    navigate(`/results/${sessionId}`, { replace: true, state: { playerId } });
    return null;
  }

  if (!quiz.currentQuestion) {
    return <div className="page-center"><LoadingSpinner /></div>;
  }

  function handleAnswer(selectedIndex: number) {
    quiz.answerQuestion(selectedIndex, timer.timeRemaining);
  }

  function handleNext() {
    quiz.nextQuestion();
    timer.reset();
  }

  return (
    <div className="quiz-game">
      <div className="quiz-header">
        <ProgressIndicator current={quiz.currentIndex + 1} total={quiz.totalQuestions} />
        <TimerBar
          percentRemaining={timer.percentRemaining}
          timeRemaining={timer.timeRemaining}
          isPaused={quiz.answered}
        />
        <ScoreDisplay
          players={[{ playerId, name: '', score: quiz.score, connected: true, isHost: true }]}
          currentPlayerId={playerId}
        />
      </div>

      <QuestionCard
        question={quiz.currentQuestion}
        onAnswer={handleAnswer}
        disabled={quiz.answered || quiz.isLoading}
        lastResult={quiz.lastResult}
        selectedIndex={quiz.selectedIndex}
        hardMode={settings.hardMode}
        revealed={quiz.revealed}
      />

      {quiz.revealed && (
        <div className="post-answer">
          <div className={`points-earned ${quiz.lastResult?.correct ? 'correct' : 'incorrect'}`}>
            {quiz.lastResult?.correct
              ? `+${quiz.lastResult.pointsEarned} points!`
              : quiz.selectedIndex === -1
                ? "Time's up!"
                : 'Incorrect!'}
          </div>
          <button className="btn btn-primary" onClick={handleNext}>
            {quiz.currentIndex + 1 >= quiz.totalQuestions ? 'See Results' : 'Next Question'}
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================
// Multiplayer Inner
// =============================================

interface MultiplayerInnerProps {
  sessionId: string;
  playerId: string;
  isHost: boolean;
  initialQuestion: ClientQuestion;
  questionIndex: number;
  totalQuestions: number;
  settings: GameSettings;
}

function MultiplayerGameInner({
  sessionId,
  playerId,
  isHost,
  initialQuestion,
  questionIndex,
  totalQuestions,
  settings,
}: MultiplayerInnerProps) {
  const navigate = useNavigate();

  const mp = useMultiplayer({
    sessionId,
    playerId,
    isHost,
    initialQuestion,
    questionIndex,
    totalQuestions,
    settings,
  });

  const handleTimerExpire = useCallback(() => {
    mp.answerQuestion(-1, 0);
  }, [mp.answerQuestion]);

  const timer = useTimer({
    totalSeconds: settings.timePerQuestion,
    onExpire: handleTimerExpire,
    isPaused: mp.answered,
  });

  // Reset the timer whenever a new question arrives
  useEffect(() => {
    timer.reset();
  }, [mp.questionIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to results when finished
  if (mp.isFinished) {
    navigate(`/results/${sessionId}`, { replace: true, state: { playerId } });
    return null;
  }

  if (!mp.currentQuestion) {
    return <div className="page-center"><LoadingSpinner /></div>;
  }

  function handleAnswer(selectedIndex: number) {
    mp.answerQuestion(selectedIndex, timer.timeRemaining);
  }

  // Determine post-answer UI
  function renderPostAnswer() {
    if (!mp.revealed && !mp.answered) return null;

    // Show "selected" state while waiting for server
    if (mp.answered && !mp.revealed) {
      return (
        <div className="post-answer">
          <p className="hint-text">Waiting for result…</p>
        </div>
      );
    }

    // Revealed but not all answered yet
    if (mp.revealed && !mp.allAnswered) {
      return (
        <div className="post-answer">
          <div className={`points-earned ${mp.lastResult?.correct ? 'correct' : 'incorrect'}`}>
            {mp.lastResult?.correct
              ? `+${mp.lastResult.pointsEarned} points!`
              : mp.selectedIndex === -1
                ? "Time's up!"
                : 'Incorrect!'}
          </div>
          <p className="hint-text">Waiting for other players…</p>
          <div className="answered-indicator">
            {mp.answeredPlayers.size} / {mp.players.filter((p) => p.connected).length} answered
          </div>
        </div>
      );
    }

    // All answered — show standings
    if (mp.allAnswered) {
      const isLastQuestion = mp.questionIndex + 1 >= mp.totalQuestions;
      return (
        <div className="post-answer">
          <div className={`points-earned ${mp.lastResult?.correct ? 'correct' : 'incorrect'}`}>
            {mp.lastResult?.correct
              ? `+${mp.lastResult.pointsEarned} points!`
              : mp.selectedIndex === -1
                ? "Time's up!"
                : 'Incorrect!'}
          </div>

          <Standings players={mp.players} currentPlayerId={playerId} />

          {mp.isHost ? (
            <button
              className="btn btn-primary"
              onClick={mp.requestNextQuestion}
              disabled={mp.isAdvancing}
            >
              {mp.isAdvancing
                ? 'Loading…'
                : isLastQuestion
                  ? 'See Results'
                  : 'Next Question'}
            </button>
          ) : (
            <p className="hint-text">
              {isLastQuestion ? 'Waiting for host to show results…' : 'Waiting for host…'}
            </p>
          )}
        </div>
      );
    }

    return null;
  }

  return (
    <div className="quiz-game">
      <div className="quiz-header">
        <ProgressIndicator current={mp.questionIndex + 1} total={mp.totalQuestions} />
        <TimerBar
          percentRemaining={timer.percentRemaining}
          timeRemaining={timer.timeRemaining}
          isPaused={mp.answered}
        />
        <ScoreDisplay
          players={mp.players.length > 0 ? mp.players : [{ playerId, name: '', score: mp.score, connected: true, isHost: true }]}
          currentPlayerId={playerId}
        />
      </div>

      <QuestionCard
        question={mp.currentQuestion}
        onAnswer={handleAnswer}
        disabled={mp.answered || mp.isLoading}
        lastResult={mp.lastResult}
        selectedIndex={mp.selectedIndex}
        hardMode={settings.hardMode}
        revealed={mp.revealed}
      />

      {renderPostAnswer()}
    </div>
  );
}
