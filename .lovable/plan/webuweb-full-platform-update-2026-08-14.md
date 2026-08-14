# WebuWeb — Full Platform Update

A large update delivered in 5 phases. Each phase is built, verified, and shipped before the next begins, so nothing breaks along the way. Existing working features are preserved unless listed as removed.

Note: no new logo file is in the project yet. Attach the WebuWeb logo image and it gets applied in Phase 1 (or the next phase after it arrives).

---

## Phase 1 — Entry flow, branding, removals, design pass

- Remove the marketing landing page. Opening the site sends signed-in users straight to the Dashboard and signed-out users straight to a redesigned Sign In / Sign Up screen (email + password, Google, forgot password, stay signed in). After auth, redirect to Dashboard; after logout, back to the auth screen. Protected routes keep working and bounce to auth with a return-to-Dashboard redirect.
- Rebrand every TreckWeb / TRECK HUB reference to WebuWeb, apply the new logo everywhere.
- Remove the Search sidebar item and page; move a single large, centered search bar high on the Dashboard. No history, no recents — bar only. Search stays non-AI and covers users, public groups, the user's own workspace folders/notes/files, help/announcement content, and products.
- Remove the Friends sidebar item (friend system itself stays, moves into Chat).
- Remove Global Chat entirely: UI, routes, uploads, and the `chat_messages` table.
- Lock Music: section stays visible but shows "Temporarily unavailable" and cannot be entered or played.
- Membership: PRO Pass and Music Pack purchases disabled with a "real payments coming soon" message; current plan, PRO status and expiry still shown. Subscription architecture untouched.
- Global visual upgrade pass: refined typography scale, deeper backgrounds, calmer glass, tighter spacing, consistent icons — luxurious and mature rather than neon.
- Fix the AI empty state: replace the decorative stars with a clean, perfectly centered WebuWeb AI mark. AI chat, streaming, history, uploads and limits are unchanged.

## Phase 2 — Chat redesign + Groups

- Chat becomes one section with four tabs: Discover, Requests, Friends, Groups.
- Discover: search users and public groups, view profiles, send friend requests, request to join groups.
- Requests: incoming friend requests plus group invitations and join requests, each with accept/decline and unread badges on the Chat nav item.
- Friends: friend list and private conversations, keeping text, images, files, PDFs, voice messages, typing indicators, timestamps, edit, delete and read status.
- Groups: one-field creation (name → Create, instantly searchable), invite friends, join requests, member management, and group chat with the same attachment/voice/typing/edit/delete support. Hard cap of 50 members enforced in the database.

## Phase 3 — Workspace universe

- Replace the current file-tree Workspace with an interactive map: folders as glowing nodes connected by thin elegant lines over a deep, subtly starred background, with smooth zoom and pan.
- Clicking a folder animates into that folder's own map level; an elegant Back control and breadcrumb return upward. Unlimited nesting depth.
- Create, rename, delete, move and organise folders and files at any level. Uploads support PDFs, documents, images, videos and text files, with download and rename. Data stays strictly private per user.

## Phase 4 — Study section

- New Study section in the sidebar with study sets containing flashcards, notes and quizzes.
- Flashcards: front/back cards, flip animation, previous/next, shuffle, progress indicator.
- Study notes: title, rich text, images.
- Quizzes: multiple choice and true/false, correct answers, scoring, results, retry.
- Study content links to Workspace folders in both directions.
- PRO-only AI generation from uploaded PDFs, documents, images or notes → summaries, flashcards, quizzes, practice questions. Exactly 3 generations per day with a visible "AI Study Generations: 3 / 3 remaining" counter, a daily reset, and a clear used-up message. Standard users keep all manual tools.

## Phase 5 — Games + languages

- Snake rebuilt as a true grid game: tile-by-tile movement, no diagonals, food, growth, self and wall collisions, score, high score, pause, restart, increasing speed, keyboard and mobile controls.
- Two additional games added: 2048 and Minesweeper. Memory Match stays. A "More Games Coming Soon" panel closes the library.
- ChessFriends stays fully in-app multiplayer with no AI opponent of any kind. Lobbies gain team modes: 2v2 Team (max 2 per side, teams lock at start, alternating A1 → B1 → A2 → B2 turn order) and 2v1 Clutch. 6- and 10-player modes shown as Coming Soon. Leaving an active game forfeits it to the opponent, and empty or abandoned lobbies are deleted so they never appear in Browse.
- Proper i18n: all UI text moved into translation files, English default, with German, Italian, French, Spanish and Romanian. The existing Language setting switches the interface live across navigation, buttons, settings, chat, games, study, workspace, membership and errors.

---

## Technical notes

- Routing: delete `src/routes/index.tsx` marketing page; `/` redirects based on session. Auth gate stays in the managed `_authenticated` layout.
- Database work (each via a reviewed migration): drop `chat_messages`; add a 50-member trigger on `group_members`; add `study_sets`, `flashcards`, `quizzes`, `quiz_questions` and `ai_study_usage` tables with owner-scoped RLS and grants; add lobby `mode`/team columns and an abandoned-lobby cleanup path for chess.
- i18n via a lightweight provider plus per-locale JSON, persisted to `profiles.language`.
- Workspace map uses the existing `folders`/`workspace_files` tables with an SVG/canvas layout layer — no data migration needed.
- Purchases: buy actions disabled at the UI layer only; purchase tables, tiers and gating logic remain intact for later Stripe wiring.
