# Pokemon Quiz — Full Implementation Plan

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites](#3-prerequisites)
4. [Phase 1: Project Setup](#phase-1-project-setup)
5. [Phase 2: Server — PokeAPI Service](#phase-2-server--pokeapi-service)
6. [Phase 3: Server — Game Session Management](#phase-3-server--game-session-management)
7. [Phase 4: Server — REST API Routes](#phase-4-server--rest-api-routes)
8. [Phase 5: Server — Anti-Cheat](#phase-5-server--anti-cheat)
9. [Phase 6: Client — Foundation](#phase-6-client--foundation)
10. [Phase 7: Client — Single Player](#phase-7-client--single-player)
11. [Phase 8: Client — Styling](#phase-8-client--styling)
12. [Phase 9: Server — Real-Time Multiplayer](#phase-9-server--real-time-multiplayer)
13. [Phase 10: Client — Multiplayer](#phase-10-client--multiplayer)
14. [Phase 11: Hard Mode](#phase-11-hard-mode)
15. [Phase 12: Sound & Confetti](#phase-12-sound--confetti)
16. [Phase 13: Results Screen](#phase-13-results-screen)
17. [Phase 14: Polish & Edge Cases](#phase-14-polish--edge-cases)
18. [Phase 15: Vercel Deployment](#phase-15-vercel-deployment)
19. [Phase 16: Final Cross-Browser Testing](#phase-16-final-cross-browser-testing)

---

## 1. Overview

A Pokemon quiz app where users see a Pokemon image and pick the correct name from 4 choices. Supports single-player and multiplayer (up to 20 players via 4-character room codes). Hosted on Vercel. Users cannot cheat by inspecting the DOM.

## 2. Architecture

| Component | Technology | Hosting |
|-----------|-----------|---------|
| Frontend | React + TypeScript + Vite | Vercel (static) |
| REST API | Vercel Serverless Functions (TypeScript) | Vercel |
| Game state storage | Upstash Redis (free tier) | Upstash cloud |
| Real-time messaging | Ably (free tier) | Ably cloud |
| Pokemon data | PokeAPI (free, no key) | External |
| Sound effects | HTML5 Audio API | Client-side |
| Confetti | canvas-confetti npm package | Client-side |

### Project Structure

```
pokemon-quiz/
├── api/                          # Vercel serverless functions
│   ├── quiz/
│   │   ├── start.ts
│   │   ├── answer.ts
│   │   └── results/[sessionId].ts
│   ├── multiplayer/
│   │   ├── create.ts
│   │   ├── join.ts
│   │   ├── start.ts
│   │   ├── answer.ts
│   │   ├── next.ts
│   │   └── lobby/[sessionId].ts
│   ├── ably-auth.ts
│   └── _lib/                     # Shared server code (not exposed as endpoints)
│       ├── types.ts
│       ├── pokeApiService.ts
│       ├── sessionService.ts
│       ├── scoringService.ts
│       ├── nameCleaningService.ts
│       └── ablyService.ts
├── client/
│   ├── public/
│   │   └── sounds/
│   │       ├── victory.mp3       # USER PLACES THIS FILE
│   │       ├── correct.mp3       # USER PLACES THIS FILE
│   │       └── wrong.mp3         # USER PLACES THIS FILE
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   ├── services/
│   │   │   ├── apiClient.ts
│   │   │   ├── realtimeClient.ts
│   │   │   └── soundService.ts
│   │   ├── hooks/
│   │   │   ├── useQuiz.ts
│   │   │   ├── useMultiplayer.ts
│   │   │   ├── useSound.ts
│   │   │   └── useTimer.ts
│   │   ├── context/
│   │   │   └── SoundContext.tsx
│   │   └── components/
│   │       ├── Home.tsx
│   │       ├── SinglePlayer/
│   │       │   └── SinglePlayerSetup.tsx
│   │       ├── Multiplayer/
│   │       │   ├── MultiplayerMenu.tsx
│   │       │   ├── HostSetup.tsx
│   │       │   ├── JoinRoom.tsx
│   │       │   └── Lobby.tsx
│   │       ├── Quiz/
│   │       │   ├── QuizGame.tsx
│   │       │   ├── QuestionCard.tsx
│   │       │   ├── OptionButton.tsx
│   │       │   ├── TimerBar.tsx
│   │       │   ├── ProgressIndicator.tsx
│   │       │   ├── ScoreDisplay.tsx
│   │       │   └── Standings.tsx
│   │       ├── Results/
│   │       │   ├── Results.tsx
│   │       │   ├── Podium.tsx
│   │       │   ├── PlayerStatsList.tsx
│   │       │   └── QuestionBreakdown.tsx
│   │       └── Shared/
│   │           ├── MuteButton.tsx
│   │           ├── BackButton.tsx
│   │           └── LoadingSpinner.tsx
│   └── vite.config.ts
├── .env.example
├── .gitignore
├── vercel.json
├── package.json
└── tsconfig.json
```

## 3. Prerequisites

Before any development, the user must:

1. Confirm Node.js is installed by running `node --version` in a terminal. Must be v18+. User has v24.13.0 which is fine.
2. Have a GitHub account (confirmed).
3. Have a Vercel account linked to GitHub (confirmed).
4. Create an Upstash Redis database (free): go to https://upstash.com, sign up, create a Redis database, copy the REST URL and REST token.
5. Create an Ably account (free): go to https://ably.com, sign up, create an app, copy the API key.
6. These values are NOT needed during local development phases (1-14). They are needed for Phase 15 (deployment). The plan will note when to set them up.

---

## Phase 1: Project Setup

### Step 1.1: Delete existing generated code

Delete everything inside `server/` and `client/` folders. Keep the `docs/` folder.

### Step 1.2: Initialize root project

Create `package.json` at root with:
- name: "pokemon-quiz"
- private: true
- No dependencies at root level (this is a monorepo-style structure)

### Step 1.3: Scaffold client with Vite

From project root, run: `npm create vite@latest client -- --template react-ts`

Then `cd client && npm install`

Install additional client dependencies:
- `react-router-dom`
- `ably`
- `canvas-confetti`

Install additional client dev dependencies:
- `@types/canvas-confetti`

### Step 1.4: Create the API directory structure

Create `api/` folder at root with `_lib/` subfolder. This is where Vercel serverless functions live.

Create `api/tsconfig.json` targeting ES2020, module commonjs, strict true.

Create root `package.json` dependencies (these are used by the API functions):
- `ably`
- `@upstash/redis`

Create root `tsconfig.json` for the API functions.

### Step 1.5: Create environment and config files

Create `.env.example` at root with:
```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ABLY_API_KEY=
```

Create `.gitignore` at root that excludes:
- `node_modules/`
- `.env`
- `.env.local`
- `dist/`
- `.vercel/`

Create `vercel.json` with:
- Build command: `cd client && npm run build`
- Output directory: `client/dist`
- Framework: vite
- Rewrites: route `/api/*` to `api/*` serverless functions
- Node.js version pinned to 20.x

### Step 1.6: Configure Vite proxy

In `client/vite.config.ts`, add a proxy rule: any request to `/api` forwards to `http://localhost:3000` during development. This simulates the Vercel routing locally.

### Step 1.7: Create local dev server for API

Use `vercel dev` for local development. This is the simplest approach and exactly matches production behavior.

Add to root `package.json` scripts:
- `"dev:client": "cd client && npm run dev"`
- `"dev:api": "vercel dev"`
- `"dev": "concurrently \"npm run dev:client\" \"npm run dev:api\""`

Install `concurrently` as a root dev dependency.

### Testing — Phase 1

1. Open terminal in `c:\dev\pokemon-quiz`
2. Run `cd client && npm run dev`. Confirm Vite starts and you see the default React page at `http://localhost:5173` in Firefox.
3. Stop the client. Run `npm install -g vercel` at the root.
4. Run `vercel dev` at the root. It will ask you to link to a Vercel project — follow the prompts (you can create a new project). Confirm it starts without errors.
5. Stop both. Run `npm run dev` at the root. Confirm both client and API dev servers start.
6. Commit to git: `git init`, `git add .`, `git commit -m "Phase 1: Project setup"`.

---

## Phase 2: Server — PokeAPI Service

### Step 2.1: Define server types

Create `api/_lib/types.ts` with the following interfaces/types:

**PokemonData:** id (number), name (string), imageUrl (string)

**Question:** questionId (string, UUID), imageUrl (string), options (string array of 4 names), correctIndex (number 0-3), correctName (string), pokemonId (number)

**ClientQuestion:** Same as Question but WITHOUT correctIndex, correctName, or pokemonId. Only questionId, imageUrl, options.

**GameSession:** sessionId (string), questions (Question array), currentQuestionIndex (number), players (PlayerInfo array), status (enum: 'waiting' | 'active' | 'finished'), roomCode (string or null), isMultiplayer (boolean), settings (GameSettings), answeredQuestions (Record mapping questionId to a Record mapping playerId to PlayerAnswer), createdAt (number, timestamp)

**PlayerInfo:** playerId (string), name (string), score (number), connected (boolean), isHost (boolean)

**PlayerAnswer:** selectedIndex (number), correct (boolean), pointsEarned (number), timeRemaining (number)

**GameSettings:** questionCount (number), timePerQuestion (number), hardMode (boolean)

**AnswerResult:** correct (boolean), correctAnswer (string), pointsEarned (number), totalScore (number)

**QuizStartResponse:** sessionId (string), playerId (string), questions (ClientQuestion array), settings (GameSettings)

**MultiplayerCreateResponse:** sessionId (string), playerId (string), roomCode (string)

**MultiplayerJoinResponse:** sessionId (string), playerId (string), players (PlayerInfo array), settings (GameSettings)

**SessionResults:** players (PlayerInfo array sorted by score desc), questions (array of ResultQuestion), settings (GameSettings)

**ResultQuestion:** questionId (string), imageUrl (string), correctAnswer (string), playerAnswers (Record mapping playerId to PlayerAnswer)

### Step 2.2: Create name cleaning service

Create `api/_lib/nameCleaningService.ts`

A function `cleanPokemonName(rawName: string): string` that:
- Capitalizes first letter of each word
- Replaces hyphens with spaces for known patterns (e.g., "mr-mime" → "Mr. Mime", "ho-oh" stays "Ho-Oh")
- Handles special cases: "farfetchd" → "Farfetch'd", "mr-mime" → "Mr. Mime", "mr-rime" → "Mr. Rime", "mime-jr" → "Mime Jr.", "type-null" → "Type: Null", "jangmo-o" / "hakamo-o" / "kommo-o" keep their format, "tapu-koko" etc. → "Tapu Koko", "nidoran-f" → "Nidoran♀", "nidoran-m" → "Nidoran♂"
- For any other hyphenated name, capitalize each part and keep the hyphen
- Store the special cases in a dictionary/map at the top of the file so they're easy to update

### Step 2.3: Create PokeAPI service

Create `api/_lib/pokeApiService.ts`

**Function: `getTotalPokemonCount(): Promise<number>`**
- Call `https://pokeapi.co/api/v2/pokemon-species?limit=1` and read the `count` field
- Cache this value in a module-level variable so it's only fetched once per cold start

**Function: `fetchPokemon(id: number): Promise<PokemonData | null>`**
- Call `https://pokeapi.co/api/v2/pokemon/${id}`
- Extract `name` from `response.name`, clean it with `cleanPokemonName()`
- Extract `imageUrl` from `response.sprites.other['official-artwork'].front_default`
- If imageUrl is null or empty, return null (skip this Pokemon)
- Return PokemonData object

**Function: `generateQuestions(settings: GameSettings): Promise<Question[]>`**
- Get total Pokemon count
- Generate random unique IDs (need `settings.questionCount * 4` unique Pokemon — 1 correct + 3 wrong per question)
- Fetch all Pokemon data in parallel using `Promise.all` (batch to avoid rate limiting — fetch max 20 at a time)
- Filter out any that returned null (no artwork)
- If not enough valid Pokemon after filtering, generate more until we have enough
- For each question: pick one as correct, three as wrong options, shuffle the 4 options randomly
- Assign a UUID to each question
- Return the array of Question objects

### Testing — Phase 2

Create a temporary test endpoint `api/test-questions.ts` that:
- Calls `generateQuestions({ questionCount: 5, timePerQuestion: 15, hardMode: false })`
- Returns the full Question objects (including correctIndex — this is a test-only endpoint)

Test:
1. Run `vercel dev`
2. In Firefox, navigate to `http://localhost:3000/api/test-questions`
3. Verify you get 5 questions, each with an imageUrl, 4 options, and a correctIndex
4. Open each imageUrl in a new tab — verify it loads a Pokemon image
5. Verify the correctIndex option name matches the Pokemon in the image
6. Verify Pokemon names are properly cleaned (capitalized, special characters correct)
7. Run the test 3 times to verify randomness (different Pokemon each time)
8. Delete the test endpoint after verification
9. Commit: `git commit -m "Phase 2: PokeAPI service"`

---

## Phase 3: Server — Game Session Management

### Step 3.1: Create scoring service

Create `api/_lib/scoringService.ts`

**Constants (defined at top of file with clear comments for future tweaking):**
- `BASE_POINTS = 200`
- `MAX_BONUS_POINTS = 200`
- `INCORRECT_POINTS = 0`

**Function: `calculateScore(correct: boolean, timeRemainingSeconds: number, totalTimeSeconds: number): number`**
- If not correct, return INCORRECT_POINTS
- bonus = Math.floor(MAX_BONUS_POINTS * (timeRemainingSeconds / totalTimeSeconds))
- Return BASE_POINTS + bonus

### Step 3.2: Create session service

Create `api/_lib/sessionService.ts`

For local development (Phases 1-14), use an in-memory `Map<string, GameSession>`. Add a clear comment at the top: `// TODO: Replace with Upstash Redis for production (Phase 15)`. This keeps development simple without requiring Redis setup until deployment.

**Function: `createSinglePlayerSession(playerName: string, settings: GameSettings): Promise<QuizStartResponse>`**
- Generate sessionId (UUID)
- Generate questions via pokeApiService
- Create a PlayerInfo with a generated playerId, the given name, score 0, connected true, isHost true
- Create GameSession with status 'active', isMultiplayer false, roomCode null
- Store in Map
- Return sessionId, playerId, and questions mapped to ClientQuestion (strip correctIndex, correctName, pokemonId)

**Function: `createMultiplayerSession(playerName: string, settings: GameSettings): Promise<MultiplayerCreateResponse>`**
- Same as above but status 'waiting', isMultiplayer true
- Generate a 4-character room code using `generateRoomCode()`
- Return sessionId, playerId, roomCode

**Function: `generateRoomCode(): string`**
- Characters: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (excludes 0/O, 1/I/L to avoid confusion)
- Generate 4 random characters
- Check uniqueness against all active sessions
- Retry if duplicate (max 100 attempts, then throw error)

**Function: `joinMultiplayerSession(roomCode: string, playerName: string): Promise<MultiplayerJoinResponse>`**
- Find session by roomCode where status is 'waiting'
- If not found, throw error "Room not found"
- If session has 20 players, throw error "Room is full (max 20 players)"
- If playerName already exists in session, throw error "Name already taken"
- Add new PlayerInfo (isHost false)
- Return sessionId, playerId, players list, settings

**Function: `getSession(sessionId: string): GameSession | undefined`**

**Function: `submitAnswer(sessionId: string, playerId: string, questionId: string, selectedIndex: number, timeRemainingSeconds: number): AnswerResult`**
- Get session, validate it exists and is active
- Find question by questionId
- Check player hasn't already answered this question (check answeredQuestions map)
- Determine if correct (selectedIndex === question.correctIndex)
- Calculate score using scoringService
- Record the answer in answeredQuestions
- Update player's total score
- Return AnswerResult

**Function: `allPlayersAnswered(sessionId: string, questionId: string): boolean`**
- Check if all connected players have an entry in answeredQuestions for this questionId

**Function: `advanceQuestion(sessionId: string): ClientQuestion | null`**
- Increment currentQuestionIndex
- If past end, set status to 'finished', return null
- Return next question as ClientQuestion

**Function: `getResults(sessionId: string): SessionResults`**
- Build results with players sorted by score desc
- Include per-question breakdown with each player's answer

**Function: `removePlayer(sessionId: string, playerId: string): void`**
- Set player's connected to false
- If player was host, transfer host to next connected player

**Constant: `MAX_PLAYERS = 20`**

### Testing — Phase 3

Create a temporary test endpoint `api/test-session.ts` that:
- Creates a single-player session with 5 questions
- Submits answers for questions (alternating correct/incorrect with varying time remaining)
- Returns the session state after each operation

Test:
1. Run `vercel dev`
2. Hit the test endpoint
3. Verify: session created with 5 ClientQuestions (no correctIndex visible), answers accepted, score calculated correctly, duplicate answer rejected, results contain breakdown
4. Verify scoring math: a correct answer with 10s remaining out of 15s = 200 + floor(200 * 10/15) = 200 + 133 = 333 points
5. Delete the test endpoint
6. Commit: `git commit -m "Phase 3: Session management"`

---

## Phase 4: Server — REST API Routes

### Step 4.1: Single player endpoints

Each Vercel serverless function exports a default function with signature `(req: VercelRequest, res: VercelResponse)`.

**`api/quiz/start.ts`** — POST
- Body: `{ playerName: string, questionCount?: number, timePerQuestion?: number, hardMode?: boolean }`
- Validate: playerName is string, 1-35 chars. questionCount 5-20 default 10. timePerQuestion 5-60 default 15. hardMode boolean default false.
- Call `createSinglePlayerSession()`
- Return 200 with QuizStartResponse

**`api/quiz/answer.ts`** — POST
- Body: `{ sessionId: string, playerId: string, questionId: string, selectedIndex: number, timeRemaining: number }`
- Validate all fields present. selectedIndex must be 0-3. timeRemaining must be 0 to timePerQuestion.
- Call `submitAnswer()`
- Return 200 with AnswerResult

**`api/quiz/results/[sessionId].ts`** — GET
- Extract sessionId from URL params
- Call `getResults()`
- Return 200 with SessionResults

### Step 4.2: Multiplayer endpoints

**`api/multiplayer/create.ts`** — POST
- Body: `{ playerName: string, questionCount?: number, timePerQuestion?: number, hardMode?: boolean }`
- Same validation as quiz/start
- Call `createMultiplayerSession()`
- Return 200 with MultiplayerCreateResponse

**`api/multiplayer/join.ts`** — POST
- Body: `{ roomCode: string, playerName: string }`
- Validate: roomCode is exactly 4 characters. playerName 1-35 chars.
- Call `joinMultiplayerSession()`
- Return 200 or 404/400 with error message

**`api/multiplayer/lobby/[sessionId].ts`** — GET
- Return `{ roomCode, players, settings, status }`

**`api/multiplayer/start.ts`** — POST
- Body: `{ sessionId: string, playerId: string }`
- Verify player isHost
- Verify at least 2 players
- Set session status to 'active'
- Publish `game_started` event via Ably with first ClientQuestion
- Return 200

**`api/multiplayer/answer.ts`** — POST
- Same as quiz/answer but also:
- After recording answer, check `allPlayersAnswered()`
- If all answered, publish `all_answered` event via Ably with standings
- Return 200 with AnswerResult

**`api/multiplayer/next.ts`** — POST
- Body: `{ sessionId: string, playerId: string }`
- Verify player isHost
- Call `advanceQuestion()`
- If null, publish `game_over` event via Ably
- Otherwise publish `next_question` event via Ably with ClientQuestion
- Return 200

### Step 4.3: Ably auth endpoint

**`api/ably-auth.ts`** — GET
- Creates a temporary Ably token request using the server-side ABLY_API_KEY
- Returns the token request JSON
- Client uses this to authenticate without exposing the API key

### Step 4.4: Create Ably service

Create `api/_lib/ablyService.ts`

**Function: `publishToSession(sessionId: string, eventName: string, data: any): Promise<void>`**
- Create Ably REST client using ABLY_API_KEY env var
- Get channel `game:${sessionId}`
- Publish the event

**Event names and their data payloads:**
- `player_joined`: `{ players: PlayerInfo[] }`
- `game_started`: `{ question: ClientQuestion, questionIndex: number, totalQuestions: number }`
- `answer_result`: `{ playerId: string, playerName: string, answered: true }` (broadcast to others — no score details, just that they answered)
- `all_answered`: `{ standings: PlayerInfo[], questionResults: Record<string, PlayerAnswer> }`
- `next_question`: `{ question: ClientQuestion, questionIndex: number }`
- `game_over`: `{ results: SessionResults }`
- `player_disconnected`: `{ playerId: string, players: PlayerInfo[] }`
- `host_changed`: `{ newHostId: string, players: PlayerInfo[] }`

### Testing — Phase 4

Test single player flow end-to-end using the browser or a REST client (e.g., install the VS Code extension "Thunder Client"):

1. POST `http://localhost:3000/api/quiz/start` with `{ "playerName": "Ash", "questionCount": 5, "timePerQuestion": 15, "hardMode": false }`. Verify response has sessionId, playerId, and 5 questions without correctIndex.
2. Copy a questionId from the response. POST `http://localhost:3000/api/quiz/answer` with `{ "sessionId": "...", "playerId": "...", "questionId": "...", "selectedIndex": 0, "timeRemaining": 10 }`. Verify response has correct/incorrect, correctAnswer string, pointsEarned, totalScore.
3. Submit the same answer again. Verify you get an error (already answered).
4. Answer all 5 questions. GET `http://localhost:3000/api/quiz/results/{sessionId}`. Verify results show player score and per-question breakdown.
5. Test validation: POST start with playerName = "" → expect 400. Post answer with selectedIndex = 5 → expect 400.
6. Repeat steps 1-5 in Firefox, Edge, and Chrome (these are API calls so browser doesn't matter, but verify no CORS issues).
7. Commit: `git commit -m "Phase 4: REST API routes"`

---

## Phase 5: Server — Anti-Cheat

This is not a separate implementation step but a set of **rules that must be verified** across all existing code:

### Rules

1. **ClientQuestion never contains correctIndex, correctName, or pokemonId.** Verify by searching all API response code for these field names.
2. **The answer is only revealed AFTER the player submits.** The AnswerResult contains correctAnswer only in the response to a POST answer request.
3. **A player cannot answer the same question twice.** Enforced in submitAnswer.
4. **A player cannot submit an answer for a question that hasn't been reached yet** (multiplayer). Enforce by checking questionId matches the current question's ID.
5. **The timeRemaining value is validated server-side.** It must be >= 0 and <= session settings timePerQuestion. A cheater could send timeRemaining = 999 to get max bonus, so clamp it.
6. **Room codes are not guessable.** 4 chars from 32-character alphabet = ~1 million combinations. Sufficient for casual use.

### Testing — Phase 5

1. Start a quiz via the API. Examine the full JSON response — confirm no `correctIndex` field anywhere.
2. Open browser DevTools Network tab. Start a quiz from the client (once built). Inspect every network response — no correct answers visible before submission.
3. Try submitting an answer with `timeRemaining: 999`. Verify it's clamped to the session's timePerQuestion value.
4. Try submitting the same questionId twice. Verify error response.
5. Commit: `git commit -m "Phase 5: Anti-cheat verification"`

---

## Phase 6: Client — Foundation

### Step 6.1: Define client types

Create `client/src/types.ts` matching the client-facing types from the server: ClientQuestion, PlayerInfo, AnswerResult, GameSettings, QuizStartResponse, MultiplayerCreateResponse, MultiplayerJoinResponse, SessionResults, ResultQuestion, PlayerAnswer. These are the same as server types but only the ones the client needs.

### Step 6.2: Define constants

Create `client/src/constants.ts` with:
- `DEFAULT_QUESTION_COUNT = 10`
- `MIN_QUESTION_COUNT = 5`
- `MAX_QUESTION_COUNT = 20`
- `DEFAULT_TIME_PER_QUESTION = 15`
- `MIN_TIME_PER_QUESTION = 5`
- `MAX_TIME_PER_QUESTION = 60`
- `MAX_PLAYER_NAME_LENGTH = 35`
- `ROOM_CODE_LENGTH = 4`

### Step 6.3: Create API client service

Create `client/src/services/apiClient.ts`

All functions use `fetch` with relative URLs (e.g., `/api/quiz/start`). Each function:
- Sets `Content-Type: application/json` for POST requests
- Checks `response.ok`, throws an error with the response body message if not
- Returns the parsed JSON

Functions:
- `startQuiz(playerName, questionCount, timePerQuestion, hardMode): Promise<QuizStartResponse>`
- `submitAnswer(sessionId, playerId, questionId, selectedIndex, timeRemaining): Promise<AnswerResult>`
- `getResults(sessionId): Promise<SessionResults>`
- `createRoom(playerName, questionCount, timePerQuestion, hardMode): Promise<MultiplayerCreateResponse>`
- `joinRoom(roomCode, playerName): Promise<MultiplayerJoinResponse>`
- `getLobby(sessionId): Promise<{roomCode, players, settings, status}>`
- `startMultiplayerGame(sessionId, playerId): Promise<void>`
- `submitMultiplayerAnswer(sessionId, playerId, questionId, selectedIndex, timeRemaining): Promise<AnswerResult>`
- `nextQuestion(sessionId, playerId): Promise<void>`

### Step 6.4: Create realtime client service

Create `client/src/services/realtimeClient.ts`

A class or set of functions that:
- Initializes Ably Realtime client using token auth (authUrl: `/api/ably-auth`)
- `subscribeToSession(sessionId, handlers)` — subscribes to channel `game:${sessionId}` with handlers for each event type
- `unsubscribe()` — detach from channel and close connection
- Each handler matches the event names from Phase 4 Step 4.4

### Step 6.5: Create sound service

Create `client/src/services/soundService.ts`

- Preloads three audio files: `/sounds/correct.mp3`, `/sounds/wrong.mp3`, `/sounds/victory.mp3`
- `playCorrect()`, `playWrong()`, `playVictory()` — each checks if muted before playing
- `setMuted(muted: boolean)` — stores in localStorage key `pokemon-quiz-muted`
- `isMuted(): boolean` — reads from localStorage, defaults to false (not muted)

### Step 6.6: Create sound context

Create `client/src/context/SoundContext.tsx`

React context that wraps the app and provides:
- `muted: boolean` state
- `toggleMute()` function
- `playCorrect()`, `playWrong()`, `playVictory()` functions

This allows any component to play sounds or check mute state.

### Step 6.7: Set up routing

Create `client/src/App.tsx` with react-router-dom routes:

| Path | Component |
|------|-----------|
| `/` | Home |
| `/single-player` | SinglePlayerSetup |
| `/quiz/:sessionId` | QuizGame |
| `/multiplayer` | MultiplayerMenu |
| `/multiplayer/host` | HostSetup |
| `/multiplayer/join` | JoinRoom |
| `/multiplayer/lobby/:sessionId` | Lobby |
| `/multiplayer/play/:sessionId` | QuizGame (reused, with multiplayer flag) |
| `/results/:sessionId` | Results |

The MuteButton component should be rendered outside the route (always visible, fixed position top-right).

### Step 6.8: Create shared components

**LoadingSpinner.tsx** — A simple CSS spinner centered on screen. Shown during API calls.

**BackButton.tsx** — A button that navigates back to the previous screen. Props: `to: string` (route path), `label?: string` (default "Back").

**MuteButton.tsx** — Fixed position top-right. Small square card with speaker icon. Uses SoundContext to toggle mute. Show speaker-with-waves when unmuted, speaker-with-X when muted. Styled as a small rounded square with dark background.

### Testing — Phase 6

1. Run `npm run dev`
2. Navigate to `http://localhost:5173` — should see the Home component (even if it's just placeholder text)
3. Navigate to each route manually — verify no crashes
4. Check the MuteButton appears in top-right corner on every page
5. Click MuteButton — verify icon toggles. Refresh page — verify mute state persists.
6. Open DevTools console — verify no errors
7. Test in Firefox, Edge, and Chrome
8. Commit: `git commit -m "Phase 6: Client foundation"`

---

## Phase 7: Client — Single Player

### Step 7.1: Create Home component

`client/src/components/Home.tsx`

Layout:
- Full screen dark background
- Title text "Who's That Pokemon?" large and centered above the main card
- Centered card (max-width ~400px, rounded corners, slight background color difference)
- Inside card: brief description text (e.g., "Test your Pokemon knowledge! Can you name them all?")
- Two large buttons stacked vertically: "Solo" and "Multiplayer"
- Solo navigates to `/single-player`
- Multiplayer navigates to `/multiplayer`

### Step 7.2: Create SinglePlayerSetup component

`client/src/components/SinglePlayer/SinglePlayerSetup.tsx`

Layout:
- Centered card
- Text input: "Your Name" (max 35 chars, required)
- Number input or slider: "Number of Questions" (5-20, default 10)
- Number input or slider: "Time per Question" (5-60 seconds, default 15)
- Toggle/checkbox: "Hard Mode (Silhouettes)"
- "Start Quiz" button (disabled if name is empty)
- "Back" button → navigates to `/`

On "Start Quiz" click:
- Show loading spinner
- Call `apiClient.startQuiz()` with the form values
- On success, navigate to `/quiz/${sessionId}` passing playerId and questions via router state

### Step 7.3: Create useQuiz hook

`client/src/hooks/useQuiz.ts`

State:
- sessionId, playerId (from router state)
- questions: ClientQuestion[]
- currentIndex: number (starts at 0)
- score: number
- lastResult: AnswerResult | null
- answered: boolean (whether current question has been answered)
- isFinished: boolean
- isLoading: boolean
- timePerQuestion: number
- hardMode: boolean
- answerHistory: Array of { questionId, selectedIndex, result: AnswerResult }

Functions:
- `answerQuestion(selectedIndex: number, timeRemaining: number)` — sets isLoading, calls apiClient.submitAnswer(), updates score, sets lastResult, sets answered to true, plays correct/wrong sound, adds to answerHistory
- `nextQuestion()` — increments currentIndex, resets answered and lastResult. If past end, sets isFinished.
- `currentQuestion` — derived from questions[currentIndex]

### Step 7.4: Create useTimer hook

`client/src/hooks/useTimer.ts`

Props: `totalSeconds: number`, `onExpire: () => void`, `isPaused: boolean`

Returns: `{ timeRemaining: number, percentRemaining: number, reset: () => void }`

Behavior:
- Counts down from totalSeconds to 0 every second
- When hits 0, calls onExpire once
- When isPaused is true, stops counting
- reset() restarts from totalSeconds
- percentRemaining = (timeRemaining / totalSeconds) * 100

### Step 7.5: Create QuizGame component

`client/src/components/Quiz/QuizGame.tsx`

This component is reused for single player AND multiplayer (determined by a prop or router state flag).

Layout from top to bottom:
- ProgressIndicator: "Q 1 / 10"
- TimerBar: visual progress bar + seconds number
- ScoreDisplay: current player score. If multiplayer, show all player scores.
- QuestionCard: Pokemon image + 4 answer buttons

Behavior:
- Uses useQuiz hook (single player) or receives multiplayer state via props
- Timer starts when question appears
- Timer pauses when answered
- On timer expire: auto-submit with selectedIndex = -1 (treated as incorrect, 0 points, timeRemaining = 0)
- After answering: show feedback on buttons (green/red), show "+X points" animation, show "Next Question" button
- On "Next Question" click: advance to next question, reset timer
- When all questions done: navigate to `/results/${sessionId}`

### Step 7.6: Create QuestionCard component

Props: question (ClientQuestion), onAnswer (function), disabled (boolean), lastResult (AnswerResult | null), selectedIndex (number | null), hardMode (boolean)

Layout:
- Text: "Who's That Pokemon?" above the image
- Pokemon image: large, centered, max-width 250px. If hardMode and not yet answered, apply CSS `filter: brightness(0)` to show silhouette. On answer, remove filter to reveal.
- 2x2 grid of OptionButton components below the image

### Step 7.7: Create OptionButton component

Props: text (string), index (number), onClick (function), disabled (boolean), state ('default' | 'correct' | 'incorrect' | 'missed')

- 'default': neutral styling (dark button, light text)
- 'correct': green background
- 'incorrect': red background (the one the user clicked that was wrong)
- 'missed': outlined green (shows which was correct when user picked wrong)
- Capitalize the Pokemon name (should already be clean from server)
- Minimum height 48px for touch targets

State logic (determined by parent):
- Before answering: all buttons are 'default'
- After answering correctly: the clicked button becomes 'correct', others stay 'default'
- After answering incorrectly: the clicked button becomes 'incorrect', the correct one becomes 'missed', others stay 'default'
- After timer expires (no answer): the correct one becomes 'missed', others stay 'default'

### Step 7.8: Create TimerBar component

Props: percentRemaining (number), timeRemaining (number), isPaused (boolean)

- A horizontal bar that shrinks from left to right
- Shows seconds as a number to the right of the bar
- Color changes: green (>50%), yellow (20-50%), red (<20%)
- When paused, bar stops animating

### Step 7.9: Create ProgressIndicator component

Props: current (number), total (number)

- Displays "Q {current} / {total}" in clean text

### Step 7.10: Create ScoreDisplay component

Props: players (PlayerInfo array), currentPlayerId (string)

Single player: just shows "Score: {points}"
Multiplayer: shows all players' names and scores, sorted by score, with the current player highlighted

### Step 7.11: Create Standings component

Props: players (PlayerInfo array), currentPlayerId (string)

Shows player rankings after each question. Sorted by score descending. Shows rank number, name, score. Highlights current player.

### Testing — Phase 7

This is a major milestone. Test thoroughly:

**In Firefox:**
1. Go to Home page. Verify "Solo" and "Multiplayer" buttons appear.
2. Click "Solo". Verify setup form appears with name, question count, time, hard mode fields.
3. Enter name "Ash", leave defaults, click "Start Quiz".
4. Verify: loading spinner appears briefly, then question 1 loads.
5. Verify: Pokemon image loads and displays large and centered.
6. Verify: "Q 1 / 10" shows at top.
7. Verify: Timer bar is counting down from 15.
8. Verify: 4 answer buttons displayed in 2x2 grid with Pokemon names.
9. Click a wrong answer. Verify: your pick turns red, correct answer turns green, "+0 points" or similar feedback shown, "Next Question" button appears, timer stops.
10. Click "Next Question". Verify: question 2 loads, timer resets.
11. Click the correct answer. Verify: it turns green, score increases, points earned shown.
12. Let the timer expire on one question without answering. Verify: correct answer is revealed in green, 0 points, "Next Question" button appears.
13. Complete all 10 questions. Verify: navigates to results page.
14. Open DevTools Network tab. Start a new quiz. Inspect the `/api/quiz/start` response. Verify no `correctIndex` field in any question.
15. Inspect the `/api/quiz/answer` response. Verify `correctAnswer` only appears after you submit.

**Repeat in Edge and Chrome:**
16. Run steps 1-15 in Microsoft Edge.
17. Run steps 1-15 in Google Chrome.

18. Commit: `git commit -m "Phase 7: Single player complete"`

---

## Phase 8: Client — Styling

### Step 8.1: Create global styles

`client/src/index.css`

**Color scheme:**
- Background: `#1a1a2e` (dark navy)
- Card background: `#16213e` (slightly lighter navy)
- Card border/accent: `#e74c3c` (Pokemon red)
- Primary text: `#ffffff`
- Secondary text: `#a0a0b0`
- Correct answer: `#27ae60` (green)
- Incorrect answer: `#e74c3c` (red)
- Missed answer: `#27ae60` with 30% opacity or outlined
- Button default: `#2d3436` with white text
- Button hover: lighten 10%
- Timer green: `#27ae60`
- Timer yellow: `#f39c12`
- Timer red: `#e74c3c`
- Score/points accent: `#f1c40f` (Pokemon yellow)

**Layout rules:**
- Body: margin 0, font-family system font stack, background color, color white
- All screens: flex column, align center, justify center, min-height 100vh, padding 16px
- Cards: max-width 500px, width 100%, padding 24px, border-radius 16px, card background color
- Buttons: border-radius 12px, padding 14px 20px, font-size 16px, font-weight 600, cursor pointer, transition 0.2s
- Inputs: same border-radius, padding, dark background, white text, border 1px solid accent
- Pokemon image: max-width 250px, max-height 250px, object-fit contain
- 2x2 grid: CSS grid, 2 columns, gap 12px

**Responsive:**
- On screens < 400px: card padding reduces to 16px, image max-width 200px, font sizes reduce slightly
- All touch targets minimum 48px height

**Put all colors and key sizes as CSS custom properties (variables) at `:root`** so they're easily tweakable.

### Testing — Phase 8

1. Run the app. Verify dark background, colored cards, styled buttons across all pages.
2. Resize browser to mobile width (375px). Verify layout doesn't break, all content is accessible.
3. Verify timer bar changes color as it counts down.
4. Verify correct/incorrect button colors match the spec.
5. Test in Firefox, Edge, Chrome — verify consistent appearance.
6. Commit: `git commit -m "Phase 8: Styling"`

---

## Phase 9: Server — Real-Time Multiplayer

### Step 9.1: Create Ably service

Create `api/_lib/ablyService.ts` (as specified in Phase 4 Step 4.4 if not already created).

For local development without an Ably key, create a fallback: if `ABLY_API_KEY` env var is not set, use **polling** instead. Add a `api/multiplayer/poll/[sessionId].ts` endpoint that returns the latest session state. The client will poll this every 1 second as a fallback.

This means the app works locally without Ably, and uses Ably in production.

### Step 9.2: Create Ably auth endpoint

`api/ably-auth.ts` — as specified in Phase 4 Step 4.3.

If ABLY_API_KEY is not set, return a 501 response so the client knows to use polling.

### Step 9.3: Update multiplayer endpoints

Ensure all multiplayer endpoints (create, join, start, answer, next) publish the appropriate Ably events as specified in Phase 4 Step 4.4. If Ably is not configured, skip publishing (the client will poll).

### Step 9.4: Create polling endpoint

`api/multiplayer/poll/[sessionId].ts` — GET

Returns: `{ status, players, currentQuestion (as ClientQuestion if active), questionIndex, allAnswered, standings, gameOver, results }`

This is a comprehensive state snapshot. The client only uses this if Ably is unavailable.

### Testing — Phase 9

Testing multiplayer server endpoints (without client yet):

1. Use Thunder Client or browser to POST `/api/multiplayer/create` with `{ "playerName": "Ash", "questionCount": 5, "timePerQuestion": 15, "hardMode": false }`. Note sessionId, playerId, roomCode.
2. POST `/api/multiplayer/join` with `{ "roomCode": "XXXX", "playerName": "Misty" }`. Note second playerId.
3. POST `/api/multiplayer/join` with same roomCode and `"playerName": "Ash"`. Verify error "Name already taken".
4. GET `/api/multiplayer/lobby/{sessionId}`. Verify both players shown, status "waiting".
5. POST `/api/multiplayer/start` with `{ "sessionId": "...", "playerId": "{Ash's playerId}" }`. Verify success.
6. GET `/api/multiplayer/poll/{sessionId}`. Verify status is "active" and first question is present.
7. POST `/api/multiplayer/answer` for both players.
8. GET `/api/multiplayer/poll/{sessionId}`. Verify allAnswered is true and standings are shown.
9. POST `/api/multiplayer/next` with host's playerId. Verify next question.
10. POST `/api/multiplayer/next` with non-host playerId. Verify error.
11. Commit: `git commit -m "Phase 9: Multiplayer server"`

---

## Phase 10: Client — Multiplayer

### Step 10.1: Create MultiplayerMenu component

`client/src/components/Multiplayer/MultiplayerMenu.tsx`

Layout: Centered card with three buttons: "Host", "Join", "Back". Back goes to `/`.

### Step 10.2: Create HostSetup component

`client/src/components/Multiplayer/HostSetup.tsx`

Same form as SinglePlayerSetup (name, question count, time, hard mode) but button says "Create Game". On click: call `apiClient.createRoom()`, navigate to `/multiplayer/lobby/${sessionId}` with playerId and roomCode in router state.

### Step 10.3: Create JoinRoom component

`client/src/components/Multiplayer/JoinRoom.tsx`

Layout: Centered card with:
- Text input: "Your Name" (max 35 chars)
- Text input: "Room Code" (max 4 chars, auto-uppercase, only allow characters from the room code alphabet)
- "Join" button (disabled if name empty or code not 4 chars)
- "Back" button

On join: call `apiClient.joinRoom()`. On success, navigate to `/multiplayer/lobby/${sessionId}`. On error, show error message (room not found, room full, name taken).

### Step 10.4: Create Lobby component

`client/src/components/Multiplayer/Lobby.tsx`

Layout:
- "Waiting for Players" title
- Room code displayed in large monospace font (e.g., `ABCD`), with a "copy" button that copies to clipboard
- Player count: "Players: 3 / 20"
- Scrollable list of player names with a host indicator (crown icon or "Host" badge)
- If current player is host: "Start Game" button (enabled when 2+ players), "Leave" button
- If not host: "Waiting for host to start...", "Leave" button

Real-time updates:
- Subscribe to Ably channel `game:${sessionId}` (or poll if Ably unavailable)
- On `player_joined`: update player list
- On `game_started`: navigate to `/multiplayer/play/${sessionId}`
- On `player_disconnected`: update player list
- On `host_changed`: update who shows as host

"Leave" button: navigate to `/multiplayer`. (No need to call API to remove player — just disconnect. The server will handle disconnect via Ably presence or polling timeout.)

### Step 10.5: Create useMultiplayer hook

`client/src/hooks/useMultiplayer.ts`

This hook manages multiplayer game state and is used by QuizGame when in multiplayer mode.

State: sessionId, playerId, isHost, players, currentQuestion, questionIndex, totalQuestions, lastResult, answered, allAnswered, standings, isFinished, results, timePerQuestion, hardMode, answerHistory

Functions:
- `initFromLobby(sessionId, playerId, isHost, questions, settings)` — called when game starts
- `submitAnswer(selectedIndex, timeRemaining)` — calls apiClient.submitMultiplayerAnswer(), updates local state, plays sounds
- `requestNextQuestion()` — (host only) calls apiClient.nextQuestion()

Event handlers (from Ably or polling):
- `answer_result` broadcast (another player answered): just update that player's "answered" status
- `all_answered`: set allAnswered true, update standings
- `next_question`: set new currentQuestion, reset answered/allAnswered/lastResult
- `game_over`: set isFinished, store results
- `host_changed`: update isHost if applicable

### Step 10.6: Update QuizGame for multiplayer support

QuizGame should accept a `mode: 'single' | 'multiplayer'` prop (or determine from router state).

In multiplayer mode:
- Use useMultiplayer hook instead of useQuiz
- After answering, "Next Question" button only appears when allAnswered is true AND player is host
- Non-hosts see "Waiting..." after all answered, or "Waiting for others..." if not all answered yet
- ScoreDisplay shows all players' scores
- Standings component shown after each question when allAnswered

### Step 10.7: Handle polling fallback in client

In `client/src/services/realtimeClient.ts`, if the call to `/api/ably-auth` returns 501, switch to polling mode:
- Set an interval to GET `/api/multiplayer/poll/${sessionId}` every 1000ms
- Compare each poll response to the previous one and trigger the appropriate handlers when state changes

### Testing — Phase 10

**Test with TWO browser windows side by side (simulate 2 players):**

In Firefox:
1. Window 1: Go to Multiplayer → Host. Enter "Ash", create game. Verify lobby shows room code and "Ash (Host)" in player list.
2. Window 2: Go to Multiplayer → Join. Enter "Misty" and the room code. Click Join. Verify lobby shows both players in BOTH windows.
3. Window 1: Click "Start Game". Verify both windows navigate to the quiz and show the same Pokemon image.
4. Window 1: Answer the question. Verify Window 1 shows feedback. Verify Window 2 shows "Ash has answered" or similar indicator.
5. Window 2: Answer the question. Verify both windows show "All answered" and standings.
6. Window 1 (host): Click "Next Question". Verify both windows advance to question 2.
7. Complete all questions. Verify both windows navigate to results.
8. Verify results show both players' scores, podium, stats.

**Test host disconnect:**
9. Window 1 (host): Close the tab during a game.
10. Window 2: Verify host transfers to Misty. Misty should now see "Next Question" button.

**Test room full (optional — simulate with code change reducing MAX_PLAYERS to 2):**
11. With max 2, try joining from a third window. Verify error.

**Test duplicate name:**
12. Create a room as "Ash". Try joining with "Ash". Verify error.

**Repeat key tests in Edge and Chrome.**

13. Commit: `git commit -m "Phase 10: Multiplayer client"`

---

## Phase 11: Hard Mode

### Step 11.1: Apply silhouette CSS

In QuestionCard component, when `hardMode` is true and `answered` is false:
- Apply CSS class to the Pokemon image: `filter: brightness(0)` (black silhouette)
- The image retains its shape because PokeAPI artwork has transparent backgrounds

When `answered` becomes true:
- Remove the filter with a smooth transition (e.g., `transition: filter 0.5s ease`)
- The Pokemon is revealed

### Step 11.2: Pass hardMode through the flow

- SinglePlayerSetup and HostSetup include the hardMode toggle
- It's passed to the API in quiz/start and multiplayer/create
- Stored in GameSession settings
- Sent to client in QuizStartResponse (it's part of GameSettings)
- QuizGame passes it to QuestionCard

### Testing — Phase 11

1. Start a single player quiz with Hard Mode enabled.
2. Verify: Pokemon image appears as a black silhouette (shape visible, no colors).
3. Answer the question. Verify: silhouette smoothly transitions to the full color image.
4. Verify the transition takes about 0.5 seconds.
5. Start a quiz without Hard Mode. Verify: full color image from the start.
6. Test in Firefox, Edge, Chrome.
7. Commit: `git commit -m "Phase 11: Hard mode"`

---

## Phase 12: Sound & Confetti

### Step 12.1: Wire up sound effects

- In useQuiz and useMultiplayer hooks: after receiving an AnswerResult, call `playCorrect()` or `playWrong()` from SoundContext based on `result.correct`
- In Results component: on mount, call `playVictory()` from SoundContext

### Step 12.2: Wire up confetti

In Results component: on mount, fire `confetti()` from canvas-confetti library with a burst of colorful confetti from both bottom corners. Use red and yellow colors to match Pokemon theme.

### Step 12.3: User action — place sound files

**USER ACTION REQUIRED:**
Place these three files in `client/public/sounds/`:
- `victory.mp3` — your 29-second victory sound
- `correct.mp3` — a short beep/chime for correct answers (find a royalty-free one)
- `wrong.mp3` — a short buzz/beep for wrong answers (find a royalty-free one)

Suggested sources for correct/wrong sounds: https://freesound.org or https://mixkit.co/free-sound-effects/ (both free, no attribution required for some sounds).

### Testing — Phase 12

1. Verify MuteButton is visible in top-right corner of every page.
2. Start a quiz (unmuted). Answer correctly. Verify correct sound plays.
3. Answer incorrectly. Verify wrong sound plays.
4. Complete quiz. Verify confetti animation fires and victory sound plays on results screen.
5. Click MuteButton (should show muted icon). Start a new quiz. Answer. Verify NO sound plays.
6. Refresh page. Verify mute state persists (still muted).
7. Unmute. Verify sounds work again.
8. Test in Firefox, Edge, Chrome — verify audio plays in all three.
9. Commit: `git commit -m "Phase 12: Sound and confetti"`

---

## Phase 13: Results Screen

### Step 13.1: Create Results component

`client/src/components/Results/Results.tsx`

Layout from top to bottom:
- "Game Over!" title
- Podium component (top 3 players) — even in single player (just shows 1 player)
- Full ranked player list (rank, name, score)
- Player stats section
- "Play Again" button → navigates to `/`
- "Send Feedback" link below the button — opens `mailto:placeholder@example.com` with subject "Pokemon Quiz Feedback"

Fetches results from `apiClient.getResults(sessionId)` on mount.

### Step 13.2: Create Podium component

Props: top 3 players (or fewer if less than 3)

Layout: Classic podium with three columns:
- Center column (1st place): tallest, gold/yellow accent (#f1c40f), player name and score
- Left column (2nd place): medium height, silver accent (#c0c0c0), player name and score
- Right column (3rd place): shortest, bronze accent (#cd7f32), player name and score

If only 1 player (single player), show just the center column. If 2 players, show center and left.

### Step 13.3: Create PlayerStatsList component

Props: array of player stats

For each player show:
- Name
- Score
- Correct answers: X / Y (e.g., "7 / 10")
- Accuracy: percentage (e.g., "70%")
- Average answer time: seconds (e.g., "4.2s")

Calculate these from the answerHistory / SessionResults data.

### Step 13.4: Create QuestionBreakdown component

Props: questions with answers from SessionResults

For each question show:
- Small Pokemon image thumbnail
- Correct answer name
- What the player selected (with green check or red X)
- Points earned

This could be an expandable/collapsible section to avoid overwhelming the screen.

### Testing — Phase 13

1. Complete a single player quiz. Verify results page shows:
   - "Game Over!" and confetti
   - Podium with your name and score
   - Your stats (correct count, accuracy, avg time)
   - Question breakdown showing each question result
   - "Play Again" and "Send Feedback" links
2. Complete a multiplayer quiz with 2 players. Verify:
   - Podium shows both players in correct rank order
   - Full player list below
   - Each player sees their own stats
3. Click "Play Again" — verify navigation to home.
4. Click "Send Feedback" — verify email client opens with placeholder address.
5. Test in Firefox, Edge, Chrome.
6. Commit: `git commit -m "Phase 13: Results screen"`

---

## Phase 14: Polish & Edge Cases

### Step 14.1: Error handling

- All API calls wrapped in try/catch with user-friendly error messages
- Show a toast or inline error message (not alert()) for: network errors, room not found, room full, name taken, session expired
- If session not found when loading quiz (e.g., page refresh after session expired), show "Session expired" message with a button to go home

### Step 14.2: Page refresh handling

- If user refreshes during a quiz, the session state is lost from React state
- Store sessionId, playerId, and essential state in `sessionStorage` (not localStorage — we want it per tab)
- On QuizGame mount, check sessionStorage. If data exists, attempt to resume by calling the poll/lobby endpoint
- If the session no longer exists server-side, show "Session expired"

### Step 14.3: Prevent accidental navigation

- During an active quiz, if user clicks "Back" or tries to navigate away, show a confirmation ("Are you sure? Your progress will be lost.")
- Use `window.onbeforeunload` for tab close
- Use react-router's navigation blocker for in-app navigation

### Step 14.4: Loading states

- Every button that triggers an API call should show a loading state (disabled + spinner or "Loading..." text) to prevent double-clicks
- Pokemon images should show a placeholder/skeleton while loading

### Step 14.5: Room code input UX

- Auto-uppercase as user types
- Only allow valid room code characters
- Auto-submit or enable Join button when 4 characters entered

### Step 14.6: Accessibility basics

- All buttons have aria-labels where icon-only (MuteButton)
- Color is not the only indicator of correct/incorrect (add a checkmark or X icon to answer buttons after answering)
- Focus management: auto-focus the first input on each form screen

### Testing — Phase 14

1. Start a quiz. Refresh the page mid-quiz. Verify: either resumes or shows "Session expired" with a home link. No crash.
2. Start a quiz. Click browser back button. Verify: confirmation dialog appears.
3. Start a quiz. Disconnect internet (disable network in DevTools). Try to answer. Verify: error message shown, no crash.
4. Double-click an answer button rapidly. Verify: only one answer is submitted.
5. On JoinRoom, type lowercase room code. Verify: auto-uppercased.
6. Verify checkmark and X icons appear on correct/incorrect answer buttons.
7. Test in Firefox, Edge, Chrome.
8. Commit: `git commit -m "Phase 14: Polish and edge cases"`

---

## Phase 15: Vercel Deployment

### Step 15.1: Set up Upstash Redis

1. Go to https://upstash.com and sign up (free).
2. Create a new Redis database. Choose the region closest to you.
3. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the database details page.

### Step 15.2: Set up Ably

1. Go to https://ably.com and sign up (free).
2. Create a new app.
3. Copy the API key from the app's "API Keys" tab (use the first key).

### Step 15.3: Update session service for Redis

Replace the in-memory Map in `api/_lib/sessionService.ts` with Upstash Redis:

- Import `@upstash/redis`
- Initialize with env vars: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- Each session stored as `redis.set('session:${sessionId}', JSON.stringify(session), { ex: 3600 })` (1 hour expiry)
- Room codes stored as `redis.set('room:${roomCode}', sessionId, { ex: 3600 })`
- Each `get` call parses JSON back
- Each mutation (submit answer, advance question, etc.) does: get -> modify -> set (this is acceptable for casual use; if race conditions are a concern, use Redis transactions)
- The `answeredQuestions` field uses Sets in memory but must be serialized as arrays for JSON storage. Convert Set to Array before storing, Array to Set after loading.

**Important:** All the function signatures stay the same. Only the internal storage mechanism changes.

### Step 15.4: Update Ably service for production

In `api/_lib/ablyService.ts`, remove the "skip if no API key" fallback. In production, the key will always be set.

### Step 15.5: Push to GitHub

1. Create a new repository on GitHub (public).
2. In terminal at project root:
   ```
   git remote add origin https://github.com/YOUR_USERNAME/pokemon-quiz.git
   git branch -M main
   git push -u origin main
   ```

### Step 15.6: Deploy to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Vercel should auto-detect the settings from `vercel.json`. Verify:
   - Build command: `cd client && npm run build`
   - Output directory: `client/dist`
   - Root directory: `./` (default)
5. Under "Environment Variables", add:
   - `UPSTASH_REDIS_REST_URL` = (your value)
   - `UPSTASH_REDIS_REST_TOKEN` = (your value)
   - `ABLY_API_KEY` = (your value)
6. Click "Deploy"

### Step 15.7: Verify deployment

1. Vercel will provide a URL (e.g., `pokemon-quiz-xxx.vercel.app`)
2. Open it in Firefox. Test the full single player flow.
3. Open in two different browsers (Firefox + Edge). Test multiplayer.

### Step 15.8: Configure custom domain (optional)

If you have a custom domain, add it in Vercel project settings → Domains.

### Testing — Phase 15

1. Open the Vercel URL in Firefox. Start a single player quiz. Complete it. Verify everything works end-to-end.
2. Open in two browsers. Create a multiplayer room in one. Join from the other. Play through. Verify real-time updates work (via Ably, not polling).
3. Open DevTools → Network tab. Verify all API calls go to `/api/*` and return successfully.
4. Verify no CORS errors in the console.
5. Verify Pokemon images load (they come from PokeAPI CDN — should work anywhere).
6. Verify sounds play on the deployed version.
7. Test in Firefox, Edge, Chrome.
8. Commit any fixes: `git add . && git commit -m "Phase 15: Vercel deployment" && git push`

---

## Phase 16: Final Cross-Browser Testing

Complete test matrix. For each browser (Firefox, Edge, Chrome), verify:

| Test | Firefox | Edge | Chrome |
|------|---------|------|--------|
| Home page loads | ☐ | ☐ | ☐ |
| Single player setup form works | ☐ | ☐ | ☐ |
| Quiz loads with Pokemon image | ☐ | ☐ | ☐ |
| Timer counts down | ☐ | ☐ | ☐ |
| Answer buttons highlight correctly | ☐ | ☐ | ☐ |
| Score calculates correctly | ☐ | ☐ | ☐ |
| Hard mode silhouette works | ☐ | ☐ | ☐ |
| Hard mode reveal transition | ☐ | ☐ | ☐ |
| Correct sound plays | ☐ | ☐ | ☐ |
| Wrong sound plays | ☐ | ☐ | ☐ |
| Mute button works and persists | ☐ | ☐ | ☐ |
| Results page shows podium | ☐ | ☐ | ☐ |
| Results page shows stats | ☐ | ☐ | ☐ |
| Results page shows question breakdown | ☐ | ☐ | ☐ |
| Confetti fires on results | ☐ | ☐ | ☐ |
| Victory sound plays on results | ☐ | ☐ | ☐ |
| Play Again returns to home | ☐ | ☐ | ☐ |
| Send Feedback opens email client | ☐ | ☐ | ☐ |
| Multiplayer: create room | ☐ | ☐ | ☐ |
| Multiplayer: join room | ☐ | ☐ | ☐ |
| Multiplayer: lobby shows players | ☐ | ☐ | ☐ |
| Multiplayer: game plays correctly | ☐ | ☐ | ☐ |
| Multiplayer: host disconnect transfers | ☐ | ☐ | ☐ |
| Multiplayer: results show all players | ☐ | ☐ | ☐ |
| No correct answers in network responses | ☐ | ☐ | ☐ |
| Mobile layout (375px width) usable | ☐ | ☐ | ☐ |
| Page refresh during quiz handled | ☐ | ☐ | ☐ |
| Back navigation shows confirmation | ☐ | ☐ | ☐ |

Final commit: `git push` — Vercel auto-deploys.

---

## Quick Reference: User Actions Required

These are the ONLY manual steps the user must perform (everything else is built by the AI agent):

| When | Action |
|------|--------|
| Before Phase 1 | Install Node.js v18+ (already done — v24.13.0) |
| Before Phase 1 | Create Vercel account (already done) |
| Phase 1 testing | Run `npm install -g vercel` and link project |
| Phase 12 | Place `victory.mp3`, `correct.mp3`, `wrong.mp3` in `client/public/sounds/` |
| Phase 15 | Create Upstash Redis account and database |
| Phase 15 | Create Ably account and app |
| Phase 15 | Push to GitHub |
| Phase 15 | Import project in Vercel and set env vars |
| Phase 16 | Test in Firefox, Edge, Chrome |
| After Phase 16 | Replace `placeholder@example.com` with real email in Results.tsx |
