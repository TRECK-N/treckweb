# WebuWeb — Command Center Update

A large update in six parts. Everything that exists today keeps working; the Home page becomes a futuristic AI command center with a real voice assistant, and several sections get targeted upgrades.

## 1. Home page: AI command center

- Home (`/dashboard`) becomes full-bleed and drops the permanent left sidebar on that screen only. Every other page keeps the sidebar exactly as it is.
- Centerpiece: an animated holographic AI core (layered CSS/SVG + canvas particles, GPU-friendly, no new 3D dependency) with the WebuWeb "W" inside. Four states — idle, listening, thinking, speaking — each with its own motion register. Honors `prefers-reduced-motion` with a calm static variant.
- Around the core: eight glass panels — AI Assistant, Chat, Workspace, Study, Games, Music, Membership, Settings — evenly placed with thin glowing connectors to the core, hover lift/glow, icon, short description, all real links.
- Live stats strip (AI chats, notes, folders, friends, AI usage today) carried over from the current dashboard.
- Replacement navigation so nothing is hidden: a compact floating dock (bottom center) with every section, plus the existing search bar and a ⌘K command palette. On tablet/mobile the panels reflow into a scrollable grid under a smaller core, and the dock becomes a bottom bar.

## 2. Webu voice assistant

- "Talk to Webu" microphone control at the top-left of Home, wired to the core's visual states.
- Speech in: browser speech recognition where supported; otherwise record audio and transcribe via Lovable AI. Text input fallback always available.
- Intent handling: an authenticated server function sends the transcript plus a tool catalog to the AI and returns a chosen action.
- Safe tool set only — no code execution: open each section, search workspace/files/notes/study, open a specific file, folder, deck, quiz or game, start a chess lobby, plus a plain answer tool. Every tool runs under the signed-in user's own permissions, so Webu can never reach data the user couldn't open manually.
- Spoken reply via browser speech synthesis, falling back to Lovable AI text-to-speech.
- UI overlay: recognized text, state labels (Listening / Processing / Responding), and a stop button.

## 3. Workspace file previews

Clicking a file opens a premium inspector panel showing actual content: images at large size, video player, embedded PDF viewer, text/code/markdown rendered inline. Unsupported types show a clean details view plus download. Rename, move, download, delete and all current actions stay in the panel.

## 4. Study: multi-answer quizzes

Questions gain a list of correct answers alongside the existing single-answer field, so current quizzes keep working unchanged. The editor lets creators tick several correct options; the player switches to checkboxes with a "select all that apply" hint and grades an answer correct only when the selection matches exactly.

## 5. Chess

- Renamed "ChessFriends" → "Chess" everywhere in the UI; only "1v1" mode is offered on creation. Existing lobbies and multiplayer stay intact.
- Automatic lobby cleanup: when a lobby becomes empty it gets an `empty_since` timestamp; joining clears it. A scheduled server-side job deletes lobbies empty for more than a minute, and Browse Lobbies also filters out expired ones immediately. Cleanup is done in a single safe database step so a lobby can't be deleted mid-join.

## 6. Authentication reset

- All existing accounts and their data are deleted (AI threads and messages, notes, folders, workspace files including stored objects, study decks/quizzes/attempts, friendships, direct messages, chess lobbies, purchases, profiles). Emails become immediately reusable.
- Deletion runs server-side with privileged credentials; nothing privileged reaches the browser.
- Then the full flow is verified end to end in a real browser: register, login, refresh, navigate, logout, protected pages blocked, login again with data intact, a second account registers independently and cannot see the first user's data.

## Technical notes

- New: `src/components/ai-core.tsx`, `src/components/webu-voice.tsx`, `src/lib/webu.functions.ts` (tool dispatch), `src/routes/api/webu-voice.ts` (STT/TTS proxy), `src/components/file-preview.tsx`, `src/components/command-palette.tsx`.
- Migrations: `study_questions.correct_indexes int[]` (nullable, falls back to `correct_index`); `chess_lobbies.empty_since timestamptz` plus a cleanup function and a pg_cron schedule; a one-off destructive reset migration for the account wipe.
- Reuses the existing Supabase clients, RLS, storage buckets, i18n, theming and AI gateway helper. No router, auth-layout or existing-route changes beyond the ones listed.
