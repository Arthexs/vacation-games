const crypto = require('crypto');
const { broadcastLeaderboard, getSnapshot } = require('../broadcast');

module.exports = function registerPlayerSocket(io, socket, state, gamesById) {
  socket.on('player:join', ({ name } = {}) => {
    const id = crypto.randomUUID();
    state.players[id] = { id, name, score: 0, connected: true, socketId: socket.id };
    socket.data.playerId = id;
    socket.join('players');

    // Client stores this id in localStorage so a later refresh can player:rejoin instead.
    socket.emit('player:joined', { playerId: id });
    socket.emit('state:snapshot', getSnapshot(state));
    broadcastLeaderboard(io, state);
  });

  socket.on('player:rejoin', ({ playerId } = {}) => {
    const player = state.players[playerId];
    if (!player) {
      socket.emit('player:rejoinFailed');
      return;
    }

    player.connected = true;
    player.socketId = socket.id;
    socket.data.playerId = playerId;
    socket.join('players');

    socket.emit('state:snapshot', getSnapshot(state));
    broadcastLeaderboard(io, state);
  });

  socket.on('player:action', (payload) => {
    if (!state.activeGame) return; // ignore stray actions once a game has ended
    const game = gamesById[state.activeGame.gameId];
    game.handleAction(io, state, socket.data.playerId, payload);
  });

  socket.on('disconnect', () => {
    const player = state.players[socket.data.playerId];
    if (!player) return;
    // Keep their name/score — a phone locking or losing signal shouldn't erase progress.
    player.connected = false;
    broadcastLeaderboard(io, state);
  });
};
