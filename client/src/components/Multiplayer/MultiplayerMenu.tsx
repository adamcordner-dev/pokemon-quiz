// ============================================
// Multiplayer Menu
// ============================================

import { useNavigate } from 'react-router-dom';
import BackButton from '../Shared/BackButton';

export default function MultiplayerMenu() {
  const navigate = useNavigate();

  return (
    <div className="page-center">
      <div className="card">
        <BackButton to="/" />
        <h2>Multiplayer</h2>

        <div className="menu-buttons">
          <button className="btn btn-primary full-width" onClick={() => navigate('/multiplayer/host')}>
            Host Game
          </button>
          <button className="btn btn-secondary full-width" onClick={() => navigate('/multiplayer/join')}>
            Join Game
          </button>
        </div>
      </div>
    </div>
  );
}
