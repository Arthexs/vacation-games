// Shared helpers for building/broadcasting the payloads described in the
// core interaction contract (ARCHITECTURE.md). Used by the socket handlers
// and by individual games, so the leaderboard shape only lives in one place.

function publicPlayer(player) {
  return { id: player.id, name: player.name, score: player.score, connected: player.connected };
}

function getLeaderboard(state) {
  const sorted = Object.values(state.players)
    .map(publicPlayer)
    .sort((a, b) => b.score - a.score);

  // Competition ranking (1, 1, 3, 4): tied scores share a rank, and the next
  // distinct score skips ahead by however many players tied for the rank before it.
  let rank = 0;
  let previousScore = null;
  return sorted.map((player, index) => {
    if (player.score !== previousScore) {
      rank = index + 1;
      previousScore = player.score;
    }
    return { ...player, rank };
  });
}

// lastUpdate lets a client that (re)connects mid-round replay the current
// phase immediately instead of sitting blank until the next game:update
// happens to fire — same stash-and-replay idea as tvContent/tvTimer below.
// Safe to include here (unlike a per-player secret, which never goes through
// broadcastGameUpdate/lastUpdatePayload in the first place).
// title/rules are stashed on activeGame by admin:selectGame (src/sockets/adminSocket.js)
// so a player who joins/reconnects mid-game can render the "?" rules modal
// immediately from this payload alone, with no separate round-trip.
function getActiveGamePayload(state) {
  return state.activeGame
    ? {
      gameId: state.activeGame.gameId,
      title: state.activeGame.title,
      rules: state.activeGame.rules,
      lastUpdate: state.activeGame.lastUpdatePayload || null,
    }
    : null;
}

function getSnapshot(state) {
  return {
    players: getLeaderboard(state),
    activeGame: getActiveGamePayload(state),
    gameRegistry: state.gameRegistry,
    partyStarted: state.partyStarted,
  };
}

// tv always shows the leaderboard, admin always shows it, and players see it
// whenever no game is active (their own client hides it while a game is running).
function broadcastLeaderboard(io, state) {
  io.to('players').to('admin').to('tv').emit('state:leaderboard', getLeaderboard(state));
}

// tv never changes when a game starts/ends, so it's deliberately left out here.
function broadcastActiveGame(io, state) {
  io.to('players').to('admin').emit('state:activeGame', getActiveGamePayload(state));
}

// Games should use this (instead of emitting 'game:update' directly) for any
// update meant for the whole room. Stashing the payload on activeGame lets a
// player who joins/rejoins mid-round be caught up immediately, rather than
// waiting on the next update. Per-player-only updates (e.g. a wrong-guess
// message to a single socket) should keep emitting directly and skip this.
// Also reaches `admin` — the admin socket only ever joins the `admin` room,
// so without this a game's own admin.js (the player picker, "Start Timer",
// etc.) never receives anything to render, same as broadcastLeaderboard and
// broadcastActiveGame already reaching admin below.
function broadcastGameUpdate(io, state, payload) {
  state.activeGame.lastUpdatePayload = payload;
  io.to('players').to('admin').emit('game:update', payload);
}

// players don't need this — their own view doesn't change when the party "starts",
// only tv's lobby-vs-leaderboard view and admin's start-party button do.
function broadcastPartyStarted(io, state) {
  io.to('admin').to('tv').emit('state:partyStarted', state.partyStarted);
}

// Lets a game take over /tv for a shared-screen moment (a drawing, a guess board)
// instead of the leaderboard. gameId rides along so tv.js knows which game's own
// public/games/<id>/tv.js to load and hand the payload to. Stashed on activeGame
// the same way broadcastGameUpdate stashes lastUpdatePayload, so a TV that
// reloads mid-round is caught up by tvSocket.js instead of falling back to the
// leaderboard until the next update happens to fire.
function broadcastTvContent(io, state, payload) {
  state.activeGame.tvContent = payload;
  io.to('tv').emit('tv:content', { gameId: state.activeGame.gameId, payload });
}

// Hands /tv back to the leaderboard/lobby. A game that uses broadcastTvContent
// must call this itself once its shared-screen phase ends (including from its
// own stop()) — the core server won't do this automatically.
function clearTvContent(io, state) {
  if (state.activeGame) state.activeGame.tvContent = null;
  io.to('tv').emit('tv:content', null);
}

// A standalone countdown banner for /tv, deliberately separate from tv:content:
// it can layer on top of the lobby, the leaderboard, or a tv:content takeover,
// so a game that only needs a visible clock (no full-screen content) doesn't
// need a tv.js just to show a number counting down. See src/timer.js.
function broadcastTvTimer(io, state, payload) {
  state.activeGame.tvTimer = payload;
  io.to('tv').emit('tv:timer', payload);
}

function clearTvTimer(io, state) {
  if (state.activeGame) state.activeGame.tvTimer = null;
  io.to('tv').emit('tv:timer', null);
}

// For a single player's own view of the round (a secret role, private feedback)
// rather than a whole-room update. Takes a playerId (not a socket) so it also
// works from contexts that only have an id to go on, e.g. an admin action.
function sendPlayerUpdate(io, state, playerId, payload) {
  const player = state.players[playerId];
  if (!player) return;
  io.to(player.socketId).emit('game:update', payload);
}

module.exports = {
  getLeaderboard,
  getSnapshot,
  broadcastLeaderboard,
  broadcastActiveGame,
  broadcastPartyStarted,
  broadcastGameUpdate,
  broadcastTvContent,
  clearTvContent,
  broadcastTvTimer,
  clearTvTimer,
  sendPlayerUpdate,
};
