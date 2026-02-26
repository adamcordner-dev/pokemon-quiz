// ============================================
// useQuiz Hook — Single Player Quiz State
// ============================================
// Optimistic UI: on click/timer-expire, immediately lock in the
// selection (stops timer, disables buttons). The API call fires
// right away; once it resolves we reveal correct/incorrect.

import { useState, useCallback, useMemo } from 'react';
import type { ClientQuestion, AnswerResult, GameSettings } from '../types';
import * as apiClient from '../services/apiClient';
import { useSound } from '../context/SoundContext';

export interface AnswerHistoryEntry {
  questionId: string;
  selectedIndex: number;
  result: AnswerResult;
}

interface UseQuizParams {
  sessionId: string;
  playerId: string;
  questions: ClientQuestion[];
  settings: GameSettings;
}

export function useQuiz({ sessionId, playerId, questions, settings }: UseQuizParams) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);   // selection locked in
  const [revealed, setRevealed] = useState(false);    // server result received
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [answerHistory, setAnswerHistory] = useState<AnswerHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { playCorrect, playWrong } = useSound();

  const currentQuestion = useMemo(
    () => questions[currentIndex] ?? null,
    [questions, currentIndex]
  );

  const answerQuestion = useCallback(
    async (selIndex: number, timeRemaining: number) => {
      if (answered || !currentQuestion) return;

      // ---- Immediately lock in selection ----
      setSelectedIndex(selIndex);
      setAnswered(true);    // stops timer, disables buttons
      setIsLoading(true);

      // ---- Fire API call; reveal result on response ----
      const apiIndex = selIndex < 0 ? -1 : selIndex;
      try {
        const result = await apiClient.submitAnswer(
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

        if (result.correct) playCorrect(); else playWrong();
      } catch (err) {
        console.error('Failed to submit answer:', err);
        setError(err instanceof Error ? err.message : 'Failed to submit answer. Check your connection.');
        // On error, still reveal so user isn't stuck
        setRevealed(true);
      } finally {
        setIsLoading(false);
      }
    },
    [answered, currentQuestion, sessionId, playerId, playCorrect, playWrong]
  );

  const nextQuestion = useCallback(() => {
    const nextIdx = currentIndex + 1;
    if (nextIdx >= questions.length) {
      setIsFinished(true);
    } else {
      setCurrentIndex(nextIdx);
      setAnswered(false);
      setRevealed(false);
      setLastResult(null);
      setSelectedIndex(null);
    }
  }, [currentIndex, questions.length]);

  return {
    currentQuestion,
    currentIndex,
    score,
    lastResult,
    selectedIndex,
    answered,
    revealed,
    isFinished,
    isLoading,
    answerHistory,
    answerQuestion,
    nextQuestion,
    settings,
    totalQuestions: questions.length,
    error,
  };
}
