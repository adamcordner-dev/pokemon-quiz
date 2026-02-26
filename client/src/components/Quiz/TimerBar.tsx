// ============================================
// Timer Bar
// ============================================

interface TimerBarProps {
  percentRemaining: number;
  timeRemaining: number;
  isPaused: boolean;
}

export default function TimerBar({
  percentRemaining,
  timeRemaining,
  isPaused,
}: TimerBarProps) {
  const colorClass =
    percentRemaining > 50 ? 'timer-green' : percentRemaining > 20 ? 'timer-yellow' : 'timer-red';

  return (
    <div className="timer-bar-container">
      <div className="timer-bar-track">
        <div
          className={`timer-bar-fill ${colorClass} ${isPaused ? 'paused' : ''}`}
          style={{ width: `${percentRemaining}%` }}
        />
      </div>
      <span className={`timer-seconds ${colorClass}`}>{timeRemaining}s</span>
    </div>
  );
}
