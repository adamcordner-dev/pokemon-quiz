// ============================================
// Home Page (placeholder — Phase 7 will flesh out)
// ============================================

import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="page-center">
      <h1>Who's That Pokémon?</h1>
      <p>Test your Pokémon knowledge! Can you name them all?</p>
      <div className="button-stack">
        <Link to="/single-player" className="btn btn-primary">
          Solo
        </Link>
        <Link to="/multiplayer" className="btn btn-secondary">
          Multiplayer
        </Link>
      </div>
    </div>
  );
}
