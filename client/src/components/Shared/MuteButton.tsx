// ============================================
// Mute Button
// ============================================
// Fixed top-right corner, toggles sound on/off.

import { useSound } from '../../context/SoundContext';

export default function MuteButton() {
  const { muted, toggleMute } = useSound();

  return (
    <button
      className="mute-button"
      onClick={toggleMute}
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      title={muted ? 'Unmute sounds' : 'Mute sounds'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
