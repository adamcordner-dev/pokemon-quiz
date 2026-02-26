// ============================================
// useMultiplayer Hook — Multiplayer Quiz State
// ============================================
// Manages multiplayer game state including real-time events
// from Ably or polling. Used by QuizGame in multiplayer mode.

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ClientQuestion, AnswerResult, GameSettings, PlayerInfo, SessionResults } from '../types';
import * as apiClient from '../services/apiClient';
import {
  subscribeToSession,
  unsubscribe,
  type AnswerResultEvent,
  type AllAnsweredEvent,
  type NextQuestionEvent,
  type GameOverEvent,
  type HostChangedEvent,
  type PlayerDisconnectedEvent,
} from '../services/realtimeClient';
import { useSound } from '../context/SoundContext';

export interface AnswerHistoryEntry {
  questionId: string;
  selectedIndex: number;
  result: AnswerResult;
}

interface UseMultiplayerParams {
  sessionId: string;
  playerId: string;
  isHost: boolean;
  initialQuestion: ClientQuestion;
  questionIndex: number;
  totalQuestions: number;
  settings: GameSettings;
  initialPlayers?: PlayerInfo[];
}

export function useMultiplayer({
  sessionId,
  playerId,
  isHost: initialIsHost,
  initialQuestion,
  questionIndex: initialQuestionIndex,
  totalQuestions,
  settings,
  initialPlayers,
}: UseMultiplayerParams) {
  const [currentQuestion, setCurrentQuestion] = useState<ClientQuestion>(initialQuestion);
  const [questionIndex, setQuestionIndex] = useState(initialQuestionIndex);
  const [players, setPlayers] = useState<PlayerInfo[]>(initialPlayers ?? []);
  const [isHost, setIsHost] = useState(initialIsHost);
  const [score, setScore] = useState(0);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [allAnswered, setAllAnswered] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [results, setResults] = useState<SessionResults | null>(null);
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>([]);
  const [answeredPlayers, setAnsweredPlayers] = useState<Set<string>>(new Set());

  const { playCorrect, playWrong } = useSound();

  // Track who has answered (for UI indicators)
  const answeredPlayersRef = useRef<Set<string>>(new Set());

  // Subscribe to multiplayer events
  useEffect(() => {
    subscribeToSession(sessionId, {
      onAnswerResult: (data: AnswerResultEvent) => {
        answeredPlayersRef.current.add(data.playerId);
        setAnsweredPlayers(new Set(answeredPlayersRef.current));
      },
      onAllAnswered: (data: AllAnsweredEvent) => {
        setAllAnswered(true);
        setPlayers(data.standings);
      },
      onNextQuestion: (data: NextQuestionEvent) => {
        setCurrentQuestion(data.question);
        setQuestionIndex(data.questionIndex);
        setAnswered(false);
        setRevealed(false);
        setLastResult(null);
        setSelectedIndex(null);
        setAllAnswered(false);
        setIsAdvancing(false);
        answeredPlayersRef.current = new Set();
        setAnsweredPlayers(new Set());
      },
      onGameOver: (data: GameOverEvent) => {
        setIsFinished(true);
        setResults(data.results);
      },
      onHostChanged: (data: HostChangedEvent) => {
        setPlayers(data.players);
        if (data.newHostId === playerId) {
          setIsHost(true);
        }
      },
      onPlayerDisconnected: (data: PlayerDisconnectedEvent) => {
        setPlayers(data.players);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [sessionId, playerId]);

  const answerQuestion = useCallback(
    async (selIndex: number, timeRemaining: number) => {
      if (answered || isLoading || !currentQuestion) return;

      setSelectedIndex(selIndex);
      setAnswered(true);
      setIsLoading(true);

      const apiIndex = selIndex < 0 ? -1 : selIndex;
      try {
        const result = await apiClient.submitMultiplayerAnswer(
          sessionId,
          playerId,
          currentQuestion.questionId,
          apiIndex,
          timeRemaining
        );

        setLastResult(result);
        setScore(result.totalScore);
        setRevealed(true);
        setAnswerHistory((prev) => [
          ...prev,
          { questionId: currentQuestion.questionId, selectedIndex: selIndex, result },
        ]);

        // Mark self as answered
        answeredPlayersRef.current.add(playerId);
        setAnsweredPlayers(new Set(answeredPlayersRef.current));

        if (result.correct) playCorrect(); else playWrong();
      } catch (err) {
        console.error('Failed to submit multiplayer answer:', err);
        setRevealed(true);
      } finally {
        setIsLoading(false);
      }
    },
    [answered, isLoading, currentQuestion, sessionId, playerId, playCorrect, playWrong]
  );

  const requestNextQuestion = useCallback(async () => {
    if (!isHost || isAdvancing) return;
    setIsAdvancing(true);

    try {
      const result = await apiClient.nextQuestion(sessionId, playerId);

      if (result.finished && result.results) {
        setIsFinished(true);
        setResults(result.results);
      }
      // If not finished, the next_question event from the server will update state
    } catch (err) {
      console.error('Failed to advance question:', err);
      setIsAdvancing(false);
    }
  }, [isHost, isAdvancing, sessionId, playerId]);

  return {
    currentQuestion,
    questionIndex,
    totalQuestions,
    players,
    isHost,
    score,
    lastResult,
    selectedIndex,
    answered,
    revealed,
    allAnswered,
    isFinished,
    isLoading,
    isAdvancing,
    results,
    answerHistory,
    answeredPlayers,
    answerQuestion,
    requestNextQuestion,
    settings,
  };
}
