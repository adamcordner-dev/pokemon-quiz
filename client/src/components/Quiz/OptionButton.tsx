// ============================================
// Option Button
// ============================================

export type OptionState = 'default' | 'selected' | 'correct' | 'incorrect' | 'missed';

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
  return (
    <button
      className={`option-button option-${state}`}
      onClick={() => onClick(index)}
      disabled={disabled}
    >
      {text}
    </button>
  );
}
