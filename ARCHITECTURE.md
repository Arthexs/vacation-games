# Vacation Games — Architecture Plan

Planning document only — no implementation yet. This lays out the project structure and how the pieces talk to each other: Node + Express + Socket.io, three roles (`/admin`, `/play`, `/tv`), LAN-only, in-memory state, no framework on the frontend. Updated with the resolved open decisions below.

## Mental model

Three kinds of screens, three jobs:

- **TV** (`/tv`) — always shows the live leaderboard, full stop. Never renders a game's board or any game-specific content — just current standings, all the time, whether a game is running or not. Purely passive/read-only.
- **Players** (`/play`) — each phone is an input device / controller. Enters a name once. When no game is active, the phone shows the leaderboard too (so players can check rank without looking up at the TV). When a game is active, the phone switches to that game's screen and sends actions (answers, guesses, buzzes) for it.
- **Admin** (`/admin`) — the control room. Picks which game runs next from a list, starts it, ends it, watches the live leaderboard. Reached only via an unshared URL — see "Admin access" below.

Everything flows through one Socket.io server holding one shared in-memory state object — no database, matches how the old Flask app didn't need one either, just now the state lives on the server instead of scattered across each player's cookie.

## Folder structure

```
vacation-games/
  server.js                  # entry point: create Express app + http server + Socket.io, wire routes/sockets, listen, print QR/local IP
  package.json
  .gitignore
  README.md
  ARCHITECTURE.md            # this file

  src/
    state.js                 # the shared in-memory store (see "Shared state" below)
    gameRegistry.js           # collects every game module in games/ into one list the admin picker reads

    routes/
      admin.js                # GET /admin  -> serves the admin shell page
      play.js                 # GET /play   -> serves the player shell page
      tv.js                   # GET /tv     -> serves the tv shell page (leaderboard only)

    sockets/
      adminSocket.js           # admin join, select game, end game
      playerSocket.js          # player join/rejoin, forwards in-game actions to whichever game is active
      tvSocket.js               # tv join; only ever receives leaderboard updates

    games/
      index.js                 # imports every game folder below, feeds gameRegistry
      demoGame/                 # built first — proves the whole pipeline works, doubles as the template for the rest
        meta.js                  # {id, title, description}
        server.js                # this game's socket event handlers + scoring logic
      # higherLower/, mountainQuiz/, scrollChallenge/, rotationChallenge/ — left open for now.
      # Built later, each following the exact same shape as demoGame/.

  public/                      # static files Express serves directly, no build step
    css/
      styles.css                # shared design system, consolidated (ported/cleaned up from the old app's look)
    js/
      admin.js                  # admin page client logic
      play.js                   # player page client logic (switches between leaderboard view and active-game view)
      tv.js                     # tv page client logic (leaderboard only)
    games/
      demoGame/
        play.js                  # renders + handles this game inside the player page's game area
      # one folder per real game later, same shape — no tv.js needed anywhere, since tv never shows game content
    admin.html
    play.html
    tv.html
```

Each future game gets one folder under `src/games/<name>/` (server-side rules and scoring) and a matching one under `public/games/<name>/` (client-side rendering, player screen only — never a tv variant). That symmetry is the whole point: adding your next custom game later means adding one new folder pair and registering it, not touching the core server. `demoGame` is the first one built, specifically to prove that pattern works end-to-end before the real four games get written into it.

## Shared state (conceptual shape, not code)

One object living in server memory for the whole party:

- `players` — map of player id → `{ name, score, connected, socketId }`
- `activeGame` — `null`, or `{ gameId, roundState }` where `roundState` is fully owned/defined by that game's own module (the core server never looks inside it)
- `gameRegistry` — the list of available games (id, title, description) for the admin's picker, built automatically from `src/games/*`

This replaces the old approach where a Flask session cookie *was* the state. Now the cookie (or a token in `localStorage`) only carries a player's id — the real data lives on the server, which is what makes a leaderboard and an admin view possible at all.

## Socket.io rooms

Three rooms mirror the three roles: `players`, `admin`, `tv`. Joining one happens right after a client connects and identifies itself.

- Score or player-list changes → broadcast to all three rooms (`tv` always renders it; `admin` always renders it; `players` renders it only while `activeGame` is `null`, i.e. between games).
- "Game selected" / "game ended" → broadcast to `admin` and `players` (tv doesn't care — its screen never changes).
- In-game actions (a guess, a buzz) → sent from a player to the server, handled by that game's own module, which decides what to broadcast back to `players` only.

## Core interaction contract

This is the "proper interface" milestone — the generic plumbing every future game reuses, independent of what any individual game actually does.

Client → server:
- `player:join` `{ name }` — first-time join; server creates the player record and id, sends it back so the browser can store it in `localStorage`
- `player:rejoin` `{ playerId }` — reconnect after a refresh/screen sleep, restores the existing record instead of creating a new player
- `player:action` `{ payload }` — a player's in-game input; server only accepts this while a game is active and forwards it to that game's own handler
- `admin:join` — registers the admin socket (no payload needed — access is via the unshared URL, not a check on this event)
- `admin:selectGame` `{ gameId }` — starts a game: sets `activeGame`, calls that game's `start()`
- `admin:endGame` — ends the current game: calls its `stop()`, folds final scores into `players`, clears `activeGame`
- `tv:join` — registers the tv socket

Server → clients:
- `state:snapshot` (→ whichever client just joined) — full current state so a freshly connected screen renders correctly immediately, no waiting for the next change
- `state:leaderboard` (→ all three rooms) — sent whenever scores change
- `state:activeGame` (→ `admin`, `players`) — sent whenever the active game changes, tells player phones whether to show the leaderboard or switch to the game view
- `game:update` (→ `players`) — whatever the active game's own module needs to push (its payload shape is defined per-game, not by the core contract)

## Game module contract

Every game folder under `src/games/` follows the same shape so the core server can treat all games identically:

- `meta` — id, title, description (shown in the admin's picker)
- `start(io, state)` — called on `admin:selectGame`: sets up `activeGame.roundState`, wires this game's own `player:action` handling, sends the first `game:update`
- `stop(io, state)` — called on `admin:endGame`: tears down this game's handling, folds any final scores into `players[id].score`, clears `activeGame`

This is the direct replacement for the old app's hardcoded `next_route` chaining — instead of one game automatically redirecting to the next, the admin explicitly starts and stops each one, and no game module needs to know what runs before or after it.

## Content data convention (for when the real games get built)

Confirmed shape: each game's data is basically a set of images, names, and some extra misc fields per item — matching what the old mountain quiz already did. Worth standardizing across games as a common "item" shape rather than something bespoke per game:

```
{ id, name, image, value?, ...misc }
```

`value` is optional (used by comparison-style games like higher/lower; not needed for pure identification games). Keeping this consistent means the same item pool could realistically be reused across more than one game type later, and it matches how `config.py` separated content from logic in the old app — just scoped per-game instead of one giant file.

## Player identity & reconnection

On first join, the server assigns a player id and the browser stores it (`localStorage`). If a phone's screen sleeps or the page reloads mid-party, `/play` sends that stored id back on reconnect (`player:rejoin`) instead of registering as a brand-new player — so nobody loses their name or score because their phone locked.

## Admin access

Resolved: no PIN. `/play` and `/tv` are shared openly (QR code on the TV screen). `/admin` is simply never shared or QR'd anywhere — you open it directly on your own phone, and that's the only access control.

## What's carried over vs. new

Reused (as design/reference, not literal code — the language changed):
- The visual language (gradient cards, big touch targets, rounded buttons) → becomes `public/css/styles.css`
- The "content as swappable data" pattern → becomes each game's data file, per the convention above
- LAN + QR join flow → same idea, via Node's own local-IP lookup and a `qrcode` package instead of the Python one

New, doesn't exist in the old project at all:
- Player identity, the shared server-side state, the leaderboard
- The `/admin` control room and the always-on `/tv` leaderboard display
- The game registry / start-stop lifecycle that makes future custom games pluggable

## Build order

1. Core shell: `server.js`, `state.js`, the three routes, the three socket handlers, the core interaction contract above.
2. `demoGame` — one simple working game (e.g. a single-question round) wired through the real contract, to prove admin → play → tv works live end to end.
3. Real games (`higherLower`, `mountainQuiz`, `scrollChallenge`, `rotationChallenge`) — left open, built one at a time later, each following `demoGame`'s shape.

## Resolved decisions (previously open)

- Admin access: unshared URL, no PIN.
- Leaderboard visibility: TV shows it always; players see it only between games, otherwise they see the active game.
- First milestone: includes one working demo game, not just an empty shell.
- Game content shape: `{ id, name, image, value?, ...misc }` per item, confirmed for when the real games get built.
