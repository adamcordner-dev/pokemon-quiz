// ============================================
// Sound Context
// ============================================
// Provides mute state and sound playback to all components.

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import * as soundService from '../services/soundService';

interface SoundContextValue {
  muted: boolean;
  toggleMute: () => void;
  playCorrect: () => void;
  playWrong: () => void;
  playVictory: () => void;
  stopVictory: () => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(soundService.isMuted);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundService.setMuted(next);
      return next;
    });
  }, []);

  const playCorrect = useCallback(() => soundService.playCorrect(), []);
  const playWrong = useCallback(() => soundService.playWrong(), []);
  const playVictory = useCallback(() => soundService.playVictory(), []);
  const stopVictory = useCallback(() => soundService.stopVictory(), []);

  return (
    <SoundContext.Provider
      value={{ muted, toggleMute, playCorrect, playWrong, playVictory, stopVictory }}
    >
      {children}
    </SoundContext.Provider>
  );
}

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return ctx;
}
