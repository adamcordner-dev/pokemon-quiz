// ============================================
// Score Display
// ============================================

import type { PlayerInfo } from '../../types';

interface ScoreDisplayProps {
  players: PlayerInfo[];
  currentPlayerId: string;
}

export default function ScoreDisplay({ players, currentPlayerId }: ScoreDisplayProps) {
  if (players.length <= 1) {
    const player = players.find((p) => p.playerId === currentPlayerId);
    return (
      <div className="score-display">
        Score: <span className="score-value">{player?.score ?? 0}</span>
      </div>
    );
  }

  // Multiplayer: show sorted scores
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="score-display multiplayer-scores">
      {sorted.map((p) => (
        <span
          key={p.playerId}
          className={`score-entry ${p.playerId === currentPlayerId ? 'current-player' : ''}`}
        >
          {p.name}: {p.score}
        </span>
      ))}
    </div>
  );
}
