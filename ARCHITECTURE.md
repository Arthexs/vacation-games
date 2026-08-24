# Vacation Games — Architecture Plan

Planning document only — no implementation yet. This lays out the project structure and how the pieces talk to each other: Node + Express + Socket.io, three roles (`/admin`, `/play`, `/tv`), LAN-only, in-memory state, no framework on the frontend. Updated with the resolved open decisions below.

## Mental model

Three kinds of screens, three jobs:

- **TV** (`/tv`) — before the admin starts the party, shows a join lobby (connected player list + QR code to `/play`). Once the admin starts the party, switches to the live leaderboard by default. A game can optionally take over the screen for a shared moment (a drawing, a guess board) via the `tv:content` channel — see "Core interaction contract" — and hand it back to the leaderboard when done; most games never do this and `/tv` just shows standings the whole time. Purely passive/read-only either way — it never sends anything back to the server.
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
    broadcast.js              # shared payload builders + broadcast helpers (leaderboard, activeGame, partyStarted, game updates) — used by socket handlers and every game module
    lobbyInfo.js               # computed once at startup: LAN join URL + QR code data URL, handed to tvSocket.js for the pre-game lobby
    gameRegistry.js           # collects every game module in games/ into one list the admin picker reads

    routes/
      admin.js                # GET /admin  -> serves the admin shell page
      play.js                 # GET /play   -> serves the player shell page
      tv.js                   # GET /tv     -> serves the tv shell page (lobby + leaderboard)

    sockets/
      adminSocket.js           # admin join, start party, select game, end game, score override
      playerSocket.js          # player join/rejoin, forwards in-game actions to whichever game is active
      tvSocket.js               # tv join; sends lobbyInfo + leaderboard/partyStarted updates

    games/
      index.js                 # imports every game folder below, feeds gameRegistry
      demoGame/                 # built first — proves the whole pipeline works, doubles as the template for the rest
        meta.js                  # {id, title, description}
        server.js                # this game's socket event handlers + scoring logic
      # each real game later, following the exact same shape as demoGame/.

  public/                      # static files Express serves directly, no build step
    css/
      styles.css                # shared design system, consolidated (ported/cleaned up from the old app's look)
    js/
      admin.js                  # admin page client logic
      play.js                   # player page client logic (switches between leaderboard view and active-game view)
      tv.js                     # tv page client logic (lobby, leaderboard, and any game's tv:content takeover)
    games/
      demoGame/
        play.js                  # renders + handles this game inside the player page's game area
        # tv.js   — optional: only if this game takes over /tv via tv:content (see below)
        # admin.js — optional: only if this game needs an admin-in-the-loop step (role assignment, "start timer")
      # one folder per real game later, same shape
    admin.html
    play.html
    tv.html
```

Each future game gets one folder under `src/games/<name>/` (server-side rules and scoring) and a matching one under `public/games/<name>/` (client-side rendering). That symmetry is the whole point: adding your next custom game later means adding one new folder pair and registering it, not touching the core server. Most games only need `play.js` there; `tv.js` and `admin.js` are optional per-game files a game adds only if it needs a TV takeover or an admin-driven step — see "Core interaction contract" and "Game module contract" below. `demoGame` is the first one built, specifically to prove the baseline pattern works end-to-end.

## Shared state (conceptual shape, not code)

One object living in server memory for the whole party:

- `players` — map of player id → `{ name, score, connected, socketId }`
- `activeGame` — `null`, or `{ gameId, roundState, lastUpdatePayload }`. `roundState` is fully owned/defined by that game's own module (the core server never looks inside it). `lastUpdatePayload` is set automatically by `broadcastGameUpdate()` (see "Core interaction contract") and replayed to any player who joins or reconnects mid-round, so they aren't stuck waiting for the next update.
- `partyStarted` — `false` until the admin clicks "Start Party". Separate from `activeGame`: starting the party doesn't start any specific game. Only affects `/tv` (lobby vs. leaderboard) and `/admin` (start-party button vs. game picker).
- `gameRegistry` — the list of available games (id, title, description) for the admin's picker, built automatically from `src/games/*`

This replaces the old approach where a Flask session cookie *was* the state. Now the cookie (or a token in `localStorage`) only carries a player's id — the real data lives on the server, which is what makes a leaderboard and an admin view possible at all.

## Socket.io rooms

Three rooms mirror the three roles: `players`, `admin`, `tv`. Joining one happens right after a client connects and identifies itself.

- Score or player-list changes → broadcast to all three rooms (`tv` always renders it; `admin` always renders it; `players` renders it only while `activeGame` is `null`, i.e. between games).
- "Game selected" / "game ended" → broadcast to `admin` and `players` (tv doesn't care — its screen never changes).
- "Party started" → broadcast to `admin` and `tv` only (switches `tv` from the lobby to the leaderboard; players don't care — their own view never changes when the party "starts").
- In-game actions (a guess, a buzz) → sent from a player to the server, handled by that game's own module, which decides what to broadcast back to `players` only.

## Core interaction contract

This is the "proper interface" milestone — the generic plumbing every future game reuses, independent of what any individual game actually does.

Client → server:
- `player:join` `{ name }` — first-time join; server creates the player record and id, sends it back so the browser can store it in `localStorage`
- `player:rejoin` `{ playerId }` — reconnect after a refresh/screen sleep, restores the existing record instead of creating a new player
- `player:action` `{ payload }` — a player's in-game input; server only accepts this while a game is active and forwards it to that game's own handler
- `admin:join` — registers the admin socket (no payload needed — access is via the unshared URL, not a check on this event)
- `admin:startParty` — one-way flip of `partyStarted` to `true`; switches `tv` from the lobby to the leaderboard
- `admin:selectGame` `{ gameId }` — starts a game: sets `activeGame`, calls that game's `start()`
- `admin:endGame` — ends the current game: calls its `stop()`, folds final scores into `players`, clears `activeGame`
- `admin:setScore` `{ playerId, score }` — manual override: sets a player's score directly (not additive), e.g. to recover a known score after their phone/app crashed mid-game
- `admin:action` `{ payload }` — mirrors `player:action`/`handleAction`: steers a round already in progress (assigning a secret role, starting a discussion timer) rather than starting/stopping the whole game. Only forwarded to that game's own `handleAdminAction(io, state, payload)` if it exports one — most games don't. Two payload shapes cover today's games: `{ type: 'assignRole', playerId }` and `{ type: 'startTimer' }`, but a game can define its own.
- `tv:join` — registers the tv socket

Server → clients:
- `state:snapshot` (→ whichever client just joined) — full current state so a freshly connected screen renders correctly immediately, no waiting for the next change
- `state:leaderboard` (→ all three rooms) — sent whenever scores change
- `state:activeGame` (→ `admin`, `players`) — sent whenever the active game changes, tells player phones whether to show the leaderboard or switch to the game view
- `state:partyStarted` (→ `admin`, `tv`) — sent when the admin starts the party
- `tv:lobbyInfo` (→ `tv`, on join) — `{ joinUrl, qrDataUrl }` for the pre-game lobby, computed once at startup by `lobbyInfo.js`
- `game:update` (→ `players`) — whatever the active game's own module needs to push (its payload shape is defined per-game, not by the core contract). Whole-room updates should go through `broadcastGameUpdate(io, state, payload)` (`src/broadcast.js`) rather than emitting directly — it stashes the payload on `activeGame.lastUpdatePayload` so a player who joins or reconnects mid-round is replayed the current state immediately instead of waiting on the next update. A per-player-only update (e.g. a secret role, private "wrong guess" feedback) should use `sendPlayerUpdate(io, state, playerId, payload)` instead, which emits the same `game:update` event to just that one player's socket.
- `tv:content` (→ `tv`) — `{ gameId, payload } | null`, for a game that takes over `/tv` for a shared-screen moment instead of the default leaderboard. Sent via `broadcastTvContent(io, state, payload)` (`src/broadcast.js`), which fills in `gameId` from `activeGame` and stashes it on `activeGame.tvContent` so a TV that reloads mid-round is caught up (`tvSocket.js`). `gameId` tells `public/js/tv.js` which game's own `public/games/<id>/tv.js` to load and hand the payload to — same `render(container)` / `update(container, payload)` shape as a game's `play.js`, minus the socket, since `/tv` never sends actions. A game **must** call `clearTvContent(io, state)` (sends `tv:content` as `null`) once its shared-screen phase ends, including from its own `stop()`, or `/tv` gets stuck showing stale content.
- `tv:timer` (→ `tv`) — `{ startedAt, durationMs, label? } | null`, a countdown banner layered on top of whatever `/tv` is already showing (lobby, leaderboard, or a `tv:content` takeover). Deliberately a separate channel from `tv:content` — a game that only needs a visible clock doesn't need a `tv.js`. Started via `startTimer(io, state, { seconds, label, onComplete })` (`src/timer.js`), which also stashes the payload on `activeGame.tvTimer` for reconnect catch-up, and keeps its own authoritative server-side `setTimeout` (so a backgrounded phone tab drifting doesn't stall the round) that fires `onComplete` and clears the banner. Returns a handle whose `.clear()` a game's `stop()` should call if the admin ends the round before the timer completes. A game merges the returned `timer` payload into its own player-facing update itself — `startTimer` only owns the `/tv` banner and the authoritative timeout, not what players see.

## Game module contract

Every game folder under `src/games/` follows the same shape so the core server can treat all games identically:

- `meta` — id, title, description (shown in the admin's picker)
- `start(io, state)` — called on `admin:selectGame`: sets up `activeGame.roundState`, wires this game's own `player:action` handling, sends the first `game:update` (via `broadcastGameUpdate`, see "Core interaction contract")
- `stop(io, state)` — called on `admin:endGame`: tears down this game's handling, folds any final scores into `players[id].score`, clears `activeGame`. If the game used `broadcastTvContent` and/or `startTimer`, this is also where it calls `clearTvContent`/the timer handle's `.clear()`, so the admin ending a round early doesn't leave `/tv` stuck.

This is the direct replacement for the old app's hardcoded `next_route` chaining — instead of one game automatically redirecting to the next, the admin explicitly starts and stops each one, and no game module needs to know what runs before or after it.

A game only implements what it needs beyond this baseline: `broadcastTvContent`/`clearTvContent` (+ a `public/games/<name>/tv.js`) for a shared-screen moment, `startTimer` (`src/timer.js`) for a countdown, `sendPlayerUpdate` for a private per-player update, `handleAdminAction(io, state, payload)` (+ a `public/games/<name>/admin.js`) for an admin-in-the-loop step like role assignment. None of these are required — most games use only `start`/`stop`/`handleAction`, same as `demoGame`.

A game's optional `public/games/<name>/admin.js` mirrors `play.js`'s `render(container, socket)` / `update(container, socket, payload)` shape, with one addition: both also receive a `helpers` object — `helpers.renderPlayerPicker(container, onPick)` renders the connected-player list as tappable buttons for role assignment, and `helpers.getPlayers()` returns the current leaderboard array directly (e.g. to check there are enough connected players before offering role assignment at all) — so a game doesn't have to rebuild player-list rendering/tracking itself. Loaded by `public/js/admin.js` into `#gameControlSection`, shown alongside the "End Game" button while that game is active.

A game's own `public/games/<name>/play.js` also receives a third `helpers` argument on both `render(container, socket, helpers)` and `update(container, socket, payload, helpers)` — currently just `helpers.getPlayers()`, returning the current leaderboard array (with `connected`), for a game whose player-facing UI needs to show or pick other players (a vote, a spectator list) rather than just render its own round state.

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
- The `/admin` control room and the `/tv` lobby-then-leaderboard display
- The game registry / start-stop lifecycle that makes future custom games pluggable

## Build order

1. Core shell: `server.js`, `state.js`, the three routes, the three socket handlers, the core interaction contract above. **Done.**
2. `demoGame` — one simple working game (e.g. a single-question round) wired through the real contract, to prove admin → play → tv works live end to end. **Done.**
3. Real games — see `GAME_PLANS.md` for full specs and build order. `higherLower`, `spyfall`, `imposter`, `headsUp`, `witsAndWagers` **done.** Drawful (and whatever else `GAME_PLANS.md` has picked up since) — **open, current focus.** Built one at a time, each following `demoGame`'s shape, pulling in whichever of `GAME_PLANS.md`'s core contract additions it needs.

Also built along the way, beyond the original three steps: competition-ranking tie handling, the `/tv` pre-game lobby (`admin:startParty`, QR join), the admin score override (`admin:setScore`), mid-round join/reconnect catch-up (`broadcastGameUpdate`), and `GAME_PLANS.md`'s core contract additions #1–#3 (`tv:content` takeover, the shared `/tv` timer, `sendPlayerUpdate`) — all folded into the sections above.

## Resolved decisions (previously open)

- Admin access: unshared URL, no PIN.
- Leaderboard visibility: TV shows it always once the party has started; players see it only between games, otherwise they see the active game.
- First milestone: includes one working demo game, not just an empty shell.
- Game content shape: `{ id, name, image, value?, ...misc }` per item, confirmed for when the real games get built.
- Tie handling: competition ranking (1, 1, 3, 4) for equal scores.
- Pre-game lobby: `/tv` shows a join QR + connected player list until the admin explicitly starts the party — separate from picking a specific game.
- Manual score override: admin can directly set a player's score (`admin:setScore`), for recovering a known score after a player's app crashes.
