// ============================================
// Question Card
// ============================================

import type { ClientQuestion, AnswerResult } from '../../types';
import OptionButton, { type OptionState } from './OptionButton';

interface QuestionCardProps {
  question: ClientQuestion;
  onAnswer: (index: number) => void;
  disabled: boolean;
  lastResult: AnswerResult | null;
  selectedIndex: number | null;
  hardMode: boolean;
  revealed: boolean;
}

export default function QuestionCard({
  question,
  onAnswer,
  disabled,
  lastResult,
  selectedIndex,
  hardMode,
  revealed,
}: QuestionCardProps) {

  function getOptionState(index: number): OptionState {
    // Not yet answered — default look
    if (selectedIndex === null) return 'default';

    // Answered but server hasn't responded yet — show selected button
    if (!revealed || !lastResult) {
      return index === selectedIndex ? 'selected' : 'default';
    }

    // Timer expired (selectedIndex === -1) — only highlight the correct answer
    if (selectedIndex === -1) {
      const correctIdx = question.options.indexOf(lastResult.correctAnswer);
      return index === correctIdx ? 'missed' : 'default';
    }

    // Fully revealed
    const correctIdx = question.options.indexOf(lastResult.correctAnswer);
    if (index === selectedIndex && lastResult.correct) return 'correct';
    if (index === selectedIndex && !lastResult.correct) return 'incorrect';
    if (index === correctIdx) return 'missed'; // show correct answer
    return 'default';
  }

  const showSilhouette = hardMode && !revealed;

  return (
    <div className="question-card">
      <h3 className="question-title">Who's That Pokémon?</h3>
      <div className="pokemon-image-container">
        <img
          src={question.imageUrl}
          alt="Pokemon"
          className={`pokemon-image ${showSilhouette ? 'silhouette' : ''}`}
          draggable={false}
        />
      </div>
      <div className="options-grid">
        {question.options.map((option, i) => (
          <OptionButton
            key={`${question.questionId}-${i}`}
            text={option}
            index={i}
            onClick={onAnswer}
            disabled={disabled}
            state={getOptionState(i)}
          />
        ))}
      </div>
    </div>
  );
}
