// ============================================
// Question Card
// ============================================

import { useState } from 'react';
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
  const [imageLoaded, setImageLoaded] = useState(false);

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
        {!imageLoaded && <div className="image-skeleton" />}
        <img
          src={question.imageUrl}
          alt="Pokemon"
          className={`pokemon-image ${showSilhouette ? 'silhouette' : ''} ${imageLoaded ? '' : 'image-hidden'}`}
          draggable={false}
          onLoad={() => setImageLoaded(true)}
          key={question.questionId}
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
