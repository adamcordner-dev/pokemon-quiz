// ============================================
// Client-side types for Pokemon Quiz
// ============================================
// These match the server types but only include
// what the client needs (no server-only fields).

export interface ClientQuestion {
  questionId: string;
  imageUrl: string;
  options: string[];
}

export interface GameSettings {
  questionCount: number;
  timePerQuestion: number;
  hardMode: boolean;
}

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

export interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  pointsEarned: number;
  totalScore: number;
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

export interface LobbyState {
  roomCode: string;
  players: PlayerInfo[];
  settings: GameSettings;
  status: 'waiting' | 'active' | 'finished';
}

export interface PollResponse {
  status: 'waiting' | 'active' | 'finished';
  players: PlayerInfo[];
  currentQuestion?: ClientQuestion;
  questionIndex?: number;
  totalQuestions?: number;
  allAnswered?: boolean;
  standings?: Array<{ playerId: string; name: string; score: number }>;
  results?: SessionResults;
}
