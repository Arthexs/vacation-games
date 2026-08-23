# Prompts for Claude Code

Copy-paste these into Claude Code, run from inside this project folder (it auto-reads `CLAUDE.md`; both that and `ARCHITECTURE.md` should already be in the repo root before you start).

## Prompt 1 — Milestone 1: core shell + demo game

```
Scaffold this project per ARCHITECTURE.md and CLAUDE.md (both in this repo root — read them fully first).

Build milestone 1 only:

1. package.json with dependencies (express, socket.io, qrcode) and a .gitignore (node_modules, etc.)
2. server.js: Express app, HTTP server, Socket.io instance, serves /admin, /play, /tv, and prints the LAN URL plus a QR code to the console on startup (same idea as the old Python app's local-IP + QR flow, ported to Node)
3. src/state.js: the shared in-memory state object (players, activeGame, gameRegistry)
4. src/routes/{admin,play,tv}.js and matching public/{admin,play,tv}.html + public/js/{admin,play,tv}.js implementing the core interaction contract from ARCHITECTURE.md: player join/rejoin, admin join/selectGame/endGame, tv join, and the state:snapshot / state:leaderboard / state:activeGame broadcasts
5. src/games/demoGame/ + public/games/demoGame/: one simple working game (a single-question round is enough) that proves the whole pipeline — admin selects it, it appears on connected /play phones, players submit an answer, score updates, admin ends it, everyone returns to the leaderboard view
6. Basic shared styling in public/css/styles.css — simple and mobile-friendly, doesn't need to be polished yet

Keep it as simple as possible: plain HTML/CSS/JS, no build step, no database, no auth beyond the admin URL being unshared. Comment the trickier parts (Socket.io room usage, the game start/stop lifecycle). Stop and ask before adding anything not covered in ARCHITECTURE.md.
```

## Prompt 2 — Template for adding a new mini-game later

Reuse this one for each of the four original games (higher/lower, mountain quiz, scroll challenge, rotation challenge) and any new custom game — fill in the three blanks.

```
Add a new mini-game called <NAME> to this project, following the exact pattern established by src/games/demoGame and public/games/demoGame (see ARCHITECTURE.md's "Game module contract" and "Content data convention" sections).

Game rules: <describe how it's played>
Content: <describe the images/names/data, following the { id, name, image, value?, ...misc } shape>
Scoring: <how a round is won or scored>

Register it in src/games/index.js so it shows up in the admin's game picker automatically. Don't touch the core shell (server.js, state.js, the socket handlers) unless this game genuinely needs something the current contract doesn't support — if so, stop and explain what's missing before changing shared code.
```
