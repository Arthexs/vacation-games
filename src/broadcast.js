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

function getActiveGamePayload(state) {
  return state.activeGame ? { gameId: state.activeGame.gameId } : null;
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
function broadcastGameUpdate(io, state, payload) {
  state.activeGame.lastUpdatePayload = payload;
  io.to('players').emit('game:update', payload);
}

// players don't need this — their own view doesn't change when the party "starts",
// only tv's lobby-vs-leaderboard view and admin's start-party button do.
function broadcastPartyStarted(io, state) {
  io.to('admin').to('tv').emit('state:partyStarted', state.partyStarted);
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
  sendPlayerUpdate,
};
