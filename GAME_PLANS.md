# Vacation Games — New Game Specs

Companion to `ARCHITECTURE.md` and `CLAUDE.md` — read both first. This file specs out the six party games discussed, in the order they should be built. Each spec assumes the existing core contract (`meta` / `start(io, state)` / `stop(io, state)` / `handleAction(io, state, playerId, payload)`, `state.activeGame.roundState` owned entirely by the game module, `broadcastGameUpdate` for room-wide updates, direct `io.to(player.socketId).emit(...)` for player-only updates) and follows `demoGame`'s folder shape: `src/games/<name>/` (meta + server logic) and `public/games/<name>/` (client rendering).

Decisions from planning discussion, locked in:

- **TV can show game content when a game needs it.** This overrides the "tv never renders game content" line in `ARCHITECTURE.md` — see "Core contract additions" below for how. Update that line in `ARCHITECTURE.md` once this ships.
- **Higher or Lower runs simultaneously**, not one active player at a time — every player guesses on their own phone each round.
- **The gamemaster explicitly assigns the special role each round** — Guesser in Heads Up!, Spy in Spyfall, Imposter in Imposter — by tapping a player on the admin screen, instead of the server picking randomly.
- **The gamemaster explicitly starts every round timer** with a "Start Timer" button on the admin screen, instead of a timer auto-starting the moment a phase begins — so the group can keep talking/settling in before the clock runs.
- **Every game shows its rules on `/tv` when the admin selects it, and every player gets a persistent "?" icon** that opens a rules popup at any point while that game is active.

## Core contract additions (build once, before or alongside the first game that needs each)

None of these change how existing games (`demoGame`) work — they're additive. Flag each to the user before writing it, per `CLAUDE.md`'s "don't touch shared code without checking in first."

### 1. TV content override

Today `tv` only ever receives `state:partyStarted` and `state:leaderboard` (see `broadcastGameUpdate` in `src/broadcast.js`, which deliberately excludes the `tv` room). Games that want a shared-screen moment (Drawful's drawing/vote/reveal, Wits & Wagers' guess board) need a way to push content to `/tv` and later hand control back to the leaderboard.

Suggested shape:
- New broadcast helpers in `src/broadcast.js`: `broadcastTvContent(io, state, payload)` (emits `tv:content` to the `tv` room, stashes it on `state.activeGame.tvContent` the same way `broadcastGameUpdate` stashes `lastUpdatePayload`, so a TV that reloads mid-round is caught up) and `clearTvContent(io, state)` (emits `tv:content` with `null`, reverting `/tv` to the leaderboard).
- `src/sockets/tvSocket.js` and `public/js/tv.js` need to handle `tv:content`: when it's non-null, render it (delegate to a per-game renderer); when null, fall back to leaderboard/lobby as today.
- Games using this need a third client file: `public/games/<name>/tv.js`, mirroring the existing `play.js` pattern (`render(container)` / `update(container, payload)`), loaded by `public/js/tv.js` the same way `public/js/play.js` loads a game's `play.js`.
- A game module **must** call `clearTvContent(io, state)` from its own `stop(io, state)` (or when its shared-screen phase ends) so `/tv` doesn't get stuck showing stale game content after the round is over.
- Games that don't need this (Higher/Lower, Spyfall, Imposter, Heads Up!) simply never call it — `/tv` keeps behaving exactly as it does today for them.

### 2. Shared timer helper

Heads Up! (60s), Spyfall/Imposter (discussion timer), and Wits & Wagers (guess/bet windows) all need a countdown — and in every case, the countdown itself should also be visible on `/tv`, not just on players' phones, so the room can see the clock without everyone checking their own screen. Don't reimplement `setInterval` bookkeeping per game.

Suggested shape: new `src/timer.js` exporting something like `startTimer(io, state, { seconds, label?, onComplete })` that:
- Broadcasts a single `{ startedAt, durationMs, label? }` payload to players (via whichever update channel the game is using) so each phone counts down locally in JS rather than the server ticking every second over the socket.
- Also emits that same payload as `tv:timer` to the `tv` room (a new, small pair of broadcast helpers, e.g. `broadcastTvTimer(io, state, payload)` / `clearTvTimer(io, state)` in `src/broadcast.js`), which `public/js/tv.js` renders as a persistent countdown banner layered on top of whatever `/tv` is already showing — the lobby, the leaderboard, or a game's full-content override from addition #1. This is a separate channel from `tv:content` on purpose: a game that only needs a clock on `/tv` (Heads Up!, Spyfall, Imposter) shouldn't need a per-game `tv.js` renderer just to show a number counting down, and a game using the full content override (Wits & Wagers, Drawful) still gets the timer banner over its own content for free.
- Sets one authoritative `setTimeout` server-side that calls `onComplete` when time's up, so the round ends correctly even if a phone's tab is backgrounded and its local countdown drifts.
- Returns a handle so the game's `stop()` can clear the timeout (and call `clearTvTimer`) if the admin ends the round early.

**Important:** per addition #5 below, a game should never call `startTimer()` automatically when a phase begins. The countdown only starts because the admin tapped "Start Timer" — wire that call inside the game's `handleAdminAction` for a `{ type: 'startTimer' }` action, not inside `start()` or an automatic phase transition. Until the admin starts it, the phase is just sitting there — players' phones and `/tv` should show something like "waiting for the gamemaster to start the clock" rather than a blank countdown.

### 3. Player-only update helper

`demoGame` already does this inline for wrong-guess feedback (`io.to(player.socketId).emit('game:update', payload)`). Worth promoting to a one-line helper in `broadcast.js` — `sendPlayerUpdate(io, state, playerId, payload)` — since four of the six games (Heads Up!, Spyfall, Imposter, Wits & Wagers' "your turn") need "this one player sees something different" as a core mechanic, not an edge case.

### 4. Phase/turn conventions (no shared code — just a pattern)

Games with more than one stage should keep a `phase` string in `roundState` (e.g. `'clue' | 'vote' | 'reveal'`) and switch client rendering on it. Games with enforced turn order (Imposter) should keep `turnOrder: [playerId, ...]` and `currentTurnIndex` in `roundState`.

### 5. Admin-driven role assignment & timer start

Two of the asks — "the gamemaster picks who's the one" and "the gamemaster starts the timer" — are really the same missing piece: today the only admin-to-active-game channel is `admin:selectGame` / `admin:endGame`, which start or stop a whole game, not steer it mid-round. Mirror the existing `player:action` → `handleAction` pattern with a parallel admin channel:

- New client → server event: `admin:action { payload }`, handled in `src/sockets/adminSocket.js` exactly like `playerSocket.js` already forwards `player:action` — `gamesById[state.activeGame.gameId].handleAdminAction(io, state, payload)`.
- Games that need an admin-in-the-loop step export an optional `handleAdminAction(io, state, payload)` alongside their existing `start` / `stop` / `handleAction`. Games that don't need any of this (Higher/Lower has no single special role) just don't implement it.
- Two payload shapes cover today's asks:
  - `{ type: 'assignRole', playerId }` — the game sets up its special role around the admin's chosen player instead of `Math.random()`. For Heads Up! / Spyfall / Imposter this becomes the actual trigger that populates `roundState` — `start()` itself now just puts the game into a "waiting for the gamemaster to pick a player" pending state (broadcast that so phones and `/tv` show a clear waiting message) rather than setting everything up immediately.
  - `{ type: 'startTimer' }` — the game calls the shared timer helper (addition #2) only now, never automatically.
- Admin UI needs a per-game surface for this — a new optional fourth client file, `public/games/<name>/admin.js`, mirroring `play.js` / `tv.js`'s `render(container)` / `update(container, payload)` shape, loaded by `public/js/admin.js` the same way `public/js/play.js` loads a game's own `play.js`. For role assignment this is just the connected-player list as tappable buttons — `public/js/admin.js` already renders a player list for score overrides, so reuse that component rather than rebuilding it. For timer start it's one "Start Timer" button, shown only when `roundState.phase` is at a point where a timer makes sense.
- Games that need a timer but no role (Wits & Wagers, Drawful) still need the "Start Timer" admin control; they just skip the role-assignment part.

### 6. Rules display for players and TV

- Every game's `meta.js` gains a `rules` field — plain text or an array of short bullet strings, e.g. `rules: ['One player is secretly the Spy...', 'Everyone else knows the location...', ...]`.
- `getActiveGamePayload` in `src/broadcast.js` (currently just `{ gameId }`) should include `title` and `rules` too, so any client that already has the `state:activeGame` payload can render the rules without a separate round-trip — this covers a player who joins mid-game and immediately taps "?".
- On `admin:selectGame`, alongside setting `activeGame` and calling the game's `start()`, the core admin handler should push the rules to `/tv` via the TV content override from addition #1, using a generic payload shape — e.g. `{ type: 'rules', title, rules }` — rendered by a small generic renderer built directly into `public/js/tv.js`. Every game's rules are just a title plus some text, so this doesn't need a per-game `tv.js`. Show it for a fixed duration (10–15s is a reasonable starting point — confirm with the user) before `/tv` moves on to whatever the game does next (its own content override, the "waiting for gamemaster" state from addition #5, or the leaderboard for phone-only games).
- On the player side, add a persistent "?" button to the shared game-view chrome in `public/js/play.js` (core UI, wired once — not something every game's own `play.js` reimplements) that opens a simple modal showing `state.activeGame.rules` at any point while a game is active.

---

## Build order & specs

### 1. Higher or Lower

**Roles:** none — every player plays every round simultaneously.

**Data:** reuses the existing convention exactly as designed: `{ id, name, image, value }` per item (e.g. `{ id: 'eiffel-tower', name: 'Eiffel Tower', image: '...', value: 330 }`, value in consistent units per category). Needs one content file, `src/games/higherLower/items.js`, with a decent-sized pool (30+ items) so a party doesn't repeat a round.

**Round flow:**
1. `start()`: pick a random first item as the "current" item, put it in `roundState`, broadcast it (no guess possible on item 1, it's just the baseline).
2. Pick a second random item (not yet revealed), send its `name`/`image` (not `value`) to all players via `broadcastGameUpdate`, along with the current item's `name`/`image`/`value`.
3. Each player submits `higher` or `lower` via `player:action`. Track answers per player in `roundState.answers`.
4. Once all connected players have answered (or a short timer via the shared timer helper expires), reveal the new item's `value`, resolve each player's guess, increment `roundState.streaks[playerId]` on correct / reset to 0 on wrong, award `basePoints * streak` to `player.score`, `broadcastLeaderboard`.
5. New item becomes "current," repeat from step 2 until admin ends the game.

**No TV content override needed** — if the answer-window timer in step 4 is used, `/tv` automatically picks up its countdown banner per addition #2, but this game never needs the full TV-content-override channel.

**On the admin-triggered timer rule (addition #5):** worth a deliberate exception here rather than applying it blindly. Higher/Lower's rounds are meant to move fast and back-to-back — making the admin tap "Start Timer" before every single round would slow the game down for no real benefit, unlike Heads Up! or Spyfall where that pause is the point (letting the group settle in). Recommend running this game's optional answer-window timer fully automatically, and flag that choice explicitly to the user rather than silently making it.

**Open call for the user:** base points per correct guess, and whether streak multiplier is linear (`streak`) or capped.

---

### 2. Spyfall & Imposter (shared "social deduction" engine)

Build these together as one small shared module (e.g. `src/games/_socialDeduction.js` used by both, or just heavy copy-paste from whichever is built first — the user's call on how much to actually share vs. duplicate) since both are: assign one player a different secret than everyone else → some clue/discussion phase → vote → reveal.

#### 2a. Spyfall

**Roles:** one random player = Spy, everyone else gets the same location.

**Data:** flat list of locations, `src/games/spyfall/locations.js` — just `[{ id, name }, ...]`, no images needed.

**Round flow:**
1. `start()`: pick a location, put the round in a pending state, and tell the admin (via the new `public/games/spyfall/admin.js`) to pick the Spy from the connected-player list. Players' phones and `/tv` show "waiting for the gamemaster" in the meantime.
2. Admin taps a player → `admin:action { type: 'assignRole', playerId }` → `handleAdminAction` marks that player as Spy and only now sends each player their own payload — the Spy must never see the location, so this is per-player targeted sends all the way (Spy's socket gets `{ role: 'spy' }`, everyone else gets `{ role: 'player', location }`), not one broadcast plus an override.
3. Admin taps "Start Timer" → `admin:action { type: 'startTimer' }` → the discussion timer (shared helper) starts, which automatically puts a countdown on `/tv` per addition #2. Questioning happens verbally in the room — the app doesn't need to track it, which is exactly why pausing before the clock starts (to let people settle into the location, ask "everyone ready?") matters here.
4. Two ways to end: timer runs out and the app opens a vote (`player:action` with `{ vote: playerId }`, tally in `roundState.votes`), or the Spy submits a `{ guessLocation: locationId }` action at any time, ending the round immediately.
5. Resolve: if the group's vote majority = the actual Spy, non-spy players score; if the Spy wasn't caught (vote split or wrong), Spy scores. If the Spy guessed the location correctly, Spy scores instead of the vote outcome. `stop()` folds these into `player.score`.

**Minimum players:** guard the admin's role-assignment step (or `start()`) — needs at least 3 connected players to be meaningful.

**No TV needed.**

#### 2b. Fake It Til You Make It (Imposter)

**Roles:** one random player = Imposter, gets a decoy word or blank; everyone else gets the real target word.

**Data:** word pairs, `src/games/imposter/wordPairs.js` — `[{ id, real: 'Pizza', decoy: 'Hamburger' }, ...]`. Decide with the user whether the Imposter gets a decoy word or nothing at all (nothing is harder for the Imposter, more chaotic; a decoy is gentler).

**Round flow — this one is turn-enforced, unlike Spyfall:**
1. `start()`: pick a pair, put the round in a pending state, and let the admin pick the Imposter the same way as Spyfall — `admin:action { type: 'assignRole', playerId }` → `handleAdminAction` sends per-player payloads and builds `roundState.turnOrder` (shuffled player id list) and `currentTurnIndex = 0`.
2. Only the player at `turnOrder[currentTurnIndex]` may submit a `player:action` with `{ clue: 'some word' }`; reject actions from anyone else. On a valid clue, append `{ playerId, clue }` to `roundState.clueLog`, advance `currentTurnIndex`, `broadcastGameUpdate` the full clue log plus whose turn it is now, so every phone can render "waiting for X" / "your turn."
3. After 1–2 full laps (configurable), switch `roundState.phase` to `'vote'`; same voting/reveal shape as Spyfall. If a discussion window is added before the vote, it should follow the same admin-triggered timer pattern as Spyfall rather than starting automatically.

**No full TV content override needed** for either — both are phone-only social games, which is the main reason they're a good pair to build early. Their discussion/turn timers still put a countdown on `/tv` automatically per addition #2.

---

### 3. Heads Up!

**Roles:** one player = Guesser each round, everyone else = Spectators. Per addition #5, the admin picks who's up each round rather than the game auto-rotating — this also resolves what was an open question in the original draft of this doc.

**Data:** word/phrase list, optionally grouped by category, `src/games/headsUp/words.js` — `[{ id, text, category? }, ...]`.

**Round flow:**
1. `start()` (and again after each round, while the game session continues): put the round in a pending state and let the admin pick the next Guesser via `admin:action { type: 'assignRole', playerId }` — a natural moment for the admin to physically hand the phone to whoever's up next, while the group is still chatting.
2. `handleAdminAction` picks a word, sends `{ role: 'guesser' }` to the Guesser's socket (their screen shows Pass/Correct buttons, no word); sends `{ role: 'spectator', word }` to everyone else via `broadcastGameUpdate`.
3. Once the Guesser's ready, the admin taps "Start Timer" → `admin:action { type: 'startTimer' }` starts the 60s clock (shared helper), which automatically shows the countdown on `/tv` too, per addition #2 — this pause between handing over the phone and the clock starting is exactly the "easier while chatting" case the admin-triggered-timer rule was made for.
4. Guesser taps Correct or Pass via `player:action`; each Correct increments `roundState.score` for that round and immediately picks the next word from the pool (word list needs to be long enough, or reshuffled, to not run out in 60s), re-sent only to the Guesser (spectators need the new word too — this is actually a broadcast to spectators + a Guesser-only "next word" ack, similar dual-send as Spyfall's role assignment).
5. On timer expiry: fold the round's correct-count into the Guesser's `player.score`, `broadcastLeaderboard`, then go back to step 1 and wait for the admin to pick the next Guesser.

**No TV content override needed** beyond the timer's automatic countdown banner.

---

### 4. Wits & Wagers Trivia

**Roles:** none during guessing; implicit "whoever bets correctly" during betting.

**Data:** numeric trivia questions, `src/games/witsAndWagers/questions.js` — `[{ id, question, answer }, ...]`. This is the most content-labor-intensive of the six — answers need to be accurate and well-sourced, not just plausible.

**Round flow (two phases, `roundState.phase`):**
1. **Guess phase:** `broadcastGameUpdate` the question text. Each player submits a numeric guess via `player:action`. Track in `roundState.guesses[playerId]`. The admin taps "Start Timer" (`admin:action { type: 'startTimer' }`) once the group's ready to lock in guesses, rather than the window opening the instant the question appears.
2. Sort guesses low → high, deduping identical values into one "slot" (real Wits & Wagers merges ties onto one bettable line). This sorted list is the thing that traditionally lives on a shared board — use the **TV override** from the core contract additions to show it on `/tv`, and also send it to every phone via `broadcastGameUpdate` so players can bet from their own screen without craning at the TV.
3. **Bet phase:** each player picks one guess-slot (including their own) to bet on, plus a wager amount, via `player:action` (`{ betOnPlayerId, amount }`). Cap `amount` at the player's current score so nobody bets into negative points. Again the admin explicitly starts this window's timer once betting talk has settled down.
4. **Reveal:** compute the closest-guess-without-going-over, `clearTvContent` (or push a reveal payload first, then clear), pay out winners (start simple: flat payout, e.g. 2x wager, rather than modeling real Wits & Wagers' odds bands by risk — that's a v2 refinement, not a v1 requirement), `broadcastLeaderboard`.

Since this game already uses the TV content override (addition #1) for the guess board, the (admin-triggered) guess/bet timers just layer their countdown banner on top of that content automatically — no extra wiring needed.

**Open call for the user:** confirm flat-multiplier payout for v1 vs. investing in real odds-band payouts now.

---

### 5. Jackbox-Style Drawing (Drawful)

**Roles:** every player draws each round (their own private prompt); during voting, everyone except the current drawing's author votes.

**Data:** a flat list of silly prompt strings, `src/games/drawful/prompts.js` — no images needed, prompts generate the images live.

**New client component (nothing like this exists yet):** an HTML5 `<canvas>`-based simple drawing widget in `public/games/drawful/play.js` — pointer/touch draw, one pen color/size is enough for v1, a Clear button, a Submit button that exports the canvas as a compressed `dataURL` (keep the canvas resolution modest, e.g. 500×350, to keep the socket payload small — no need for anything higher on a phone screen anyway).

**Round flow (cycles once per player's drawing — this is the most complex `roundState` of the six):**
1. `start()`: assign each connected player a random prompt (`roundState.assignments[playerId] = promptId`), `phase = 'draw'`. The admin taps "Start Timer" once everyone's ready to start drawing, rather than the clock running the instant prompts land.
2. Each player draws privately and submits via `player:action` (`{ drawingDataUrl }`), stored in `roundState.drawings[playerId]`. Once all submitted (or the draw timer expires), move to `phase = 'reveal'` and set `roundState.currentDrawingIndex = 0`.
3. For the current drawing: **TV override** shows the drawing (no prompt text) full-screen — this is the shared-screen moment the TV-override addition exists for. Also send it to every player's phone (excluding the artist) via `broadcastGameUpdate`, since players type their fake titles from their own phone.
4. Every player except the artist submits a fake title via `player:action`. Once all are in (or timer expires), shuffle the fake titles together with the real prompt, send the shuffled list to every player except the artist (again via TV override + phone broadcast) for `phase = 'vote'`.
5. Each non-artist player votes for which title they think is real via `player:action`. Score: correct guessers get points, and each fake-title author gets points for every vote their fake title tricked. Artist gets points if few/no one guessed correctly (optional — decide with the user).
6. `broadcastLeaderboard`, advance `currentDrawingIndex`, loop back to step 3 for the next player's drawing until all drawings have been shown, then `clearTvContent` and `stop()`.

Each phase's timer (drawing, fake-title submission, voting) uses the shared timer helper from addition #2, layering its countdown banner over whatever `/tv` is showing at that moment — the drawing, the shuffled title list, etc. — automatically, on top of the full-content override this game already uses. **Worth reconsidering with the user, though:** requiring an admin tap before the title and vote windows of *every single drawing* could get repetitive across a full round of drawings. A reasonable middle ground is admin-triggered only for the draw phase (where the settle-in pause genuinely helps) and auto-started for the title/vote phases (which are short and don't need a "get ready" moment) — flag this trade-off rather than mechanically requiring an admin tap everywhere.

**Open calls for the user:** exact scoring split (correct-guess points vs. tricked-someone points vs. artist points), and whether to allow players to skip voting on their own drawing automatically (yes — never let someone vote on/be tricked by their own drawing) vs. any other edge cases like a tie in votes.

---

## Notes for whoever (Claude Code) implements this

- Build the six core contract additions (TV override, timer helper, player-update helper, phase/turn conventions, admin-driven role/timer control, rules display) as their own small commits before the first game that needs each, not bundled invisibly into a game's PR — keeps `git log` and review honest about what's "core" vs. "one game's logic," matching how the existing core-shell-then-games build order was done. The admin-action channel and the rules display are the two biggest of these — both touch `src/sockets/adminSocket.js`, `src/broadcast.js`, and `public/js/admin.js`/`public/js/tv.js`/`public/js/play.js`, so they're worth their own explicit check-in with the user before writing, per `CLAUDE.md`'s "don't touch shared code without checking in first."
- Update `ARCHITECTURE.md`'s "tv never renders game content" line, the game module contract section (add `handleAdminAction` as an optional export, alongside `start`/`stop`/`handleAction`), and the "Core interaction contract" event list (add `admin:action`, `tv:content`, `tv:timer`) once these land — that file is meant to stay in sync with what's actually built (see its own opening line: "Planning document only" is already stale for the parts that are done, keep chipping at that).
- Update `CLAUDE.md`'s build-order section as each game ships, same as it already tracks `demoGame`'s completion.
- Every game folder needs `meta.js` to include a `rules` field now, not just `id`/`title`/`description`.
- Every new game folder pair should be registered in `src/games/index.js` exactly like `demoGame`, and nothing about adding a game should require editing files outside its own `src/games/<name>/` + `public/games/<name>/` pair (plus, as needed, `public/games/<name>/tv.js` for full TV takeovers and `public/games/<name>/admin.js` for role-assignment controls — both optional, most games will only need one or neither) — if a game genuinely can't be built that way, stop and say so before changing shared code, per `CLAUDE.md`.
