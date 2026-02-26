// ============================================
// Option Button
// ============================================

export type OptionState = 'default' | 'selected' | 'correct' | 'incorrect' | 'missed';

const stateIcons: Record<OptionState, string> = {
  default: '',
  selected: '',
  correct: ' ✓',
  incorrect: ' ✗',
  missed: ' ✓',
};

const stateAriaLabels: Record<OptionState, string> = {
  default: '',
  selected: '(selected)',
  correct: '(correct)',
  incorrect: '(incorrect)',
  missed: '(correct answer)',
};

interface OptionButtonProps {
  text: string;
  index: number;
  onClick: (index: number) => void;
  disabled: boolean;
  state: OptionState;
}

export default function OptionButton({
  text,
  index,
  onClick,
  disabled,
  state,
}: OptionButtonProps) {
  const icon = stateIcons[state];
  const ariaLabel = stateAriaLabels[state];

  return (
    <button
      className={`option-button option-${state}`}
      onClick={() => onClick(index)}
      disabled={disabled}
      aria-label={ariaLabel ? `${text} ${ariaLabel}` : undefined}
    >
      {text}{icon && <span className="option-icon" aria-hidden="true">{icon}</span>}
    </button>
  );
}
