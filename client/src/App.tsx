// ============================================
// App — Root component with routing
// ============================================

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SoundProvider } from './context/SoundContext';
import MuteButton from './components/Shared/MuteButton';

import Home from './components/Home';
import SinglePlayerSetup from './components/SinglePlayer/SinglePlayerSetup';
import QuizGame from './components/Quiz/QuizGame';
import MultiplayerMenu from './components/Multiplayer/MultiplayerMenu';
import HostSetup from './components/Multiplayer/HostSetup';
import JoinRoom from './components/Multiplayer/JoinRoom';
import Lobby from './components/Multiplayer/Lobby';
import Results from './components/Results/Results';

export default function App() {
  return (
    <BrowserRouter>
      <SoundProvider>
        <MuteButton />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/single-player" element={<SinglePlayerSetup />} />
          <Route path="/quiz/:sessionId" element={<QuizGame />} />
          <Route path="/multiplayer" element={<MultiplayerMenu />} />
          <Route path="/multiplayer/host" element={<HostSetup />} />
          <Route path="/multiplayer/join" element={<JoinRoom />} />
          <Route path="/multiplayer/lobby/:sessionId" element={<Lobby />} />
          <Route path="/multiplayer/play/:sessionId" element={<QuizGame />} />
          <Route path="/results/:sessionId" element={<Results />} />
        </Routes>
      </SoundProvider>
    </BrowserRouter>
  );
}
