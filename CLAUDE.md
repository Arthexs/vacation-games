# Vacation Games — Project Memory

Claude Code reads this file automatically at the start of every session in this folder. Keep it in sync with `ARCHITECTURE.md`, which is the full design doc — read that too before making structural changes.

## What this is

A LAN-only party game host: an admin (gamemaster) phone selects a mini-game and runs it live for a room of players, with a TV (HDMI) showing a join lobby before the party starts, then the live leaderboard throughout. Successor to an old single-player Flask treasure hunt that used to live in this same folder — that code has been removed. `static/mountain_images/` was kept for the future `mountainQuiz` game; everything else from the old app is gone.

## Tech stack (decided, don't second-guess this)

- Node.js + Express + Socket.io (not raw `ws` — we want its room/broadcast handling)
- Plain HTML/CSS/JS on the frontend, no React/Vue/Svelte, no bundler/build step
- In-memory server state only — no database. This runs as one process for the length of a party; that's fine.
- LAN-only. No HTTPS, no real auth. The only access control is that `/admin`'s URL is never shared/QR'd — see ARCHITECTURE.md.

## Roles

- `/admin` — gamemaster control room: start the party, pick a game, start it, end it, watch the leaderboard, override a player's score if needed. Unshared URL, no PIN.
- `/play` — each player's phone: name entry once, then either the leaderboard (between games) or the active game's screen.
- `/tv` — before the admin starts the party, shows a join lobby (player list + QR code). Once started, shows the live leaderboard by default for the rest of the party. Some games (Spyfall, Imposter, Wavelength, Drawful) briefly take the screen over for a shared moment via the `tv:content` channel, then hand it back — see ARCHITECTURE.md's "Core interaction contract".

## Build order

1. Core shell: `server.js`, `src/state.js`, the three routes/socket handlers, and the core interaction contract (see ARCHITECTURE.md § "Core interaction contract"). **Done.**
2. `src/games/demoGame/` + `public/games/demoGame/` — one simple working game that proves admin → play → tv works live end to end. Template for everything after it. **Done.**
3. Real games, one at a time, each a new folder pair under `src/games/<name>/` and `public/games/<name>/`, following `demoGame`'s exact shape and registered in `src/games/index.js`. Don't touch core shell files to add a game — if a new game genuinely needs something the current contract doesn't support, stop and say so before changing shared code, per `GAME_PLANS.md`'s "Core contract additions" (§1–6, all built — rules display shipped too: `meta.js`'s `rules` field, the `/tv` rules banner, and the player-facing "?" modal are all wired). `higherLower`, `spyfall`, `imposter`, `headsUp`, `wavelength`, `drawful` **done** (`witsAndWagers` was built and later removed — added little beyond the other games); `psych` also done, built beyond `GAME_PLANS.md`'s original spec list. Check `GAME_PLANS.md` before assuming there's nothing left — it's a living doc the user edits directly.

Also already built beyond that original three-step plan: competition-ranking tie handling, the `/tv` pre-game lobby (`admin:startParty`), an admin score override (`admin:setScore`), a `/tv` content-takeover channel + shared countdown timer + a private per-player update helper (`GAME_PLANS.md` additions #1–#3) — see ARCHITECTURE.md for the details of each.

## Content data convention

Per-item shape for any game's data: `{ id, name, image, value?, ...misc }`. `value` is only used by comparison-style games.

## Working style

- Keep dependencies minimal — don't add a library for something a few lines of plain code covers.
- Comment the non-obvious parts (Socket.io room usage, a game's start/stop lifecycle) — I'm still learning this stack, plain code with a short "why" comment beats clever code.
- Don't add features, games, or scope beyond what's asked in the current task — check in first.
