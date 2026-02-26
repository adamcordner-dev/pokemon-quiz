// ============================================
// Standings
// ============================================

import type { PlayerInfo } from '../../types';

interface StandingsProps {
  players: PlayerInfo[];
  currentPlayerId: string;
}

export default function Standings({ players, currentPlayerId }: StandingsProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="standings">
      <h4>Standings</h4>
      <ol className="standings-list">
        {sorted.map((p, i) => (
          <li
            key={p.playerId}
            className={`standings-entry ${p.playerId === currentPlayerId ? 'current-player' : ''}`}
          >
            <span className="standings-rank">#{i + 1}</span>
            <span className="standings-name">{p.name}</span>
            <span className="standings-score">{p.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
