// ============================================
// Scoring Service
// ============================================
// Calculates points awarded for each answer.
// Tweak the constants below to adjust the scoring curve.

/** Points awarded for any correct answer, regardless of speed. */
export const BASE_POINTS = 200;

/** Maximum additional points for answering instantly (0 seconds used). */
export const MAX_BONUS_POINTS = 200;

/** Points awarded for an incorrect answer. */
export const INCORRECT_POINTS = 0;

/**
 * Calculate the score for a single answer.
 *
 * Correct answers receive BASE_POINTS plus a speed bonus that scales
 * linearly with the fraction of time remaining.
 *
 * @param correct            Whether the player chose the right option.
 * @param timeRemainingSeconds  Seconds left on the timer when they answered.
 * @param totalTimeSeconds      Total seconds allowed for the question.
 * @returns Points earned (integer).
 */
export function calculateScore(
  correct: boolean,
  timeRemainingSeconds: number,
  totalTimeSeconds: number
): number {
  if (!correct) {
    return INCORRECT_POINTS;
  }

  const bonus = Math.floor(
    MAX_BONUS_POINTS * (timeRemainingSeconds / totalTimeSeconds)
  );

  return BASE_POINTS + bonus;
}
