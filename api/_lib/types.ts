// ============================================
// Server-side types for Pokemon Quiz
// ============================================

// --- Pokemon Data ---

export interface PokemonData {
  id: number;
  name: string;
  imageUrl: string;
}

// --- Questions ---

export interface Question {
  questionId: string;
  imageUrl: string;
  options: string[];
  correctIndex: number; // 0-3, SERVER ONLY — never sent to client
  correctName: string;  // SERVER ONLY — never sent to client
  pokemonId: number;    // SERVER ONLY — never sent to client
}

/** Safe question type sent to the client — no answer data */
export interface ClientQuestion {
  questionId: string;
  imageUrl: string;
  options: string[];
}

// --- Game Settings ---

export interface GameSettings {
  questionCount: number;
  timePerQuestion: number;
  hardMode: boolean;
}

// --- Players ---

export interface PlayerInfo {
  playerId: string;
  name: string;
  score: number;
  connected: boolean;
  isHost: boolean;
}

export interface PlayerAnswer {
  selectedIndex: number;
  correct: boolean;
  pointsEarned: number;
  timeRemaining: number;
}

// --- Game Session ---

export interface GameSession {
  sessionId: string;
  questions: Question[];
  currentQuestionIndex: number;
  players: PlayerInfo[];
  status: 'waiting' | 'active' | 'finished';
  roomCode: string | null;
  isMultiplayer: boolean;
  settings: GameSettings;
  /** Maps questionId -> (playerId -> PlayerAnswer) */
  answeredQuestions: Record<string, Record<string, PlayerAnswer>>;
  createdAt: number;
}

// --- API Responses ---

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  pointsEarned: number;
  totalScore: number;
}

/** Extended answer result used by the multiplayer answer endpoint.
 *  Contains everything needed in a single atomic file operation. */
export interface MultiplayerAnswerResult extends AnswerResult {
  playerName: string;
  allAnswered: boolean;
  standings: PlayerInfo[];
  questionResults: Record<string, PlayerAnswer>;
}

export interface QuizStartResponse {
  sessionId: string;
  playerId: string;
  questions: ClientQuestion[];
  settings: GameSettings;
}

export interface MultiplayerCreateResponse {
  sessionId: string;
  playerId: string;
  roomCode: string;
}

export interface MultiplayerJoinResponse {
  sessionId: string;
  playerId: string;
  players: PlayerInfo[];
  settings: GameSettings;
}

// --- Results ---

export interface SessionResults {
  players: PlayerInfo[];
  questions: ResultQuestion[];
  settings: GameSettings;
  isMultiplayer: boolean;
}

export interface ResultQuestion {
  questionId: string;
  imageUrl: string;
  correctAnswer: string;
  playerAnswers: Record<string, PlayerAnswer>;
}

// --- Helpers ---

/** Strip server-only fields from a Question to produce a ClientQuestion */
export function toClientQuestion(q: Question): ClientQuestion {
  return {
    questionId: q.questionId,
    imageUrl: q.imageUrl,
    options: [...q.options],
  };
}
