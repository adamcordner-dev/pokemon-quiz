// ============================================
// Progress Indicator
// ============================================

interface ProgressIndicatorProps {
  current: number;
  total: number;
}

export default function ProgressIndicator({ current, total }: ProgressIndicatorProps) {
  return <div className="progress-indicator">Q {current} / {total}</div>;
}
