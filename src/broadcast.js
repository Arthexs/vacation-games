// Shared helpers for building/broadcasting the payloads described in the
// core interaction contract (ARCHITECTURE.md). Used by the socket handlers
// and by individual games, so the leaderboard shape only lives in one place.

function publicPlayer(player) {
  return { id: player.id, name: player.name, score: player.score, connected: player.connected };
}

function getLeaderboard(state) {
  return Object.values(state.players)
    .map(publicPlayer)
    .sort((a, b) => b.score - a.score);
}

function getActiveGamePayload(state) {
  return state.activeGame ? { gameId: state.activeGame.gameId } : null;
}

function getSnapshot(state) {
  return {
    players: getLeaderboard(state),
    activeGame: getActiveGamePayload(state),
    gameRegistry: state.gameRegistry,
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

module.exports = { getLeaderboard, getSnapshot, broadcastLeaderboard, broadcastActiveGame };
