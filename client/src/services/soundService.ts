// ============================================
// Sound Service
// ============================================
// Preloads and plays sound effects. Mute state persisted in localStorage.

const STORAGE_KEY = 'pokemon-quiz-muted';

// Preload audio elements
const correctSound = new Audio('/sounds/correct.mp3');
const wrongSound = new Audio('/sounds/wrong.mp3');
const victorySound = new Audio('/sounds/victory.mp3');

// Preload (browsers may defer until user interaction, but this hints the intent)
correctSound.preload = 'auto';
wrongSound.preload = 'auto';
victorySound.preload = 'auto';

export function isMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(muted));
  } catch {
    // localStorage unavailable — ignore
  }
}

function play(audio: HTMLAudioElement): void {
  if (isMuted()) return;
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Autoplay blocked — ignore
  });
}

export function playCorrect(): void {
  play(correctSound);
}

export function playWrong(): void {
  play(wrongSound);
}

export function playVictory(): void {
  play(victorySound);
}

export function stopVictory(): void {
  victorySound.pause();
  victorySound.currentTime = 0;
}
