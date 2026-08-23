const { broadcastLeaderboard, broadcastActiveGame, getSnapshot } = require('../broadcast');

// Registered once per connected socket (see server.js). Access control is just
// the /admin URL being unshared — there's no auth check on these events.
module.exports = function registerAdminSocket(io, socket, state, gamesById) {
  socket.on('admin:join', () => {
    socket.join('admin');
    socket.emit('state:snapshot', getSnapshot(state));
  });

  socket.on('admin:selectGame', ({ gameId } = {}) => {
    if (state.activeGame) return; // one game at a time — end the current one first
    const game = gamesById[gameId];
    if (!game) return;

    state.activeGame = { gameId, roundState: null };
    game.start(io, state);
    broadcastActiveGame(io, state);
  });

  socket.on('admin:endGame', () => {
    if (!state.activeGame) return;
    const game = gamesById[state.activeGame.gameId];
    game.stop(io, state);
    state.activeGame = null;
    broadcastActiveGame(io, state);
    broadcastLeaderboard(io, state);
  });
};
