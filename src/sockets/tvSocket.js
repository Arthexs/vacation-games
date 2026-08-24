const { getSnapshot } = require('../broadcast');

// lobbyInfo ({ joinUrl, qrDataUrl }) is built once at server startup — see
// src/lobbyInfo.js — since the LAN IP doesn't change mid-party.
module.exports = function registerTvSocket(io, socket, state, lobbyInfo) {
  socket.on('tv:join', () => {
    socket.join('tv');
    socket.emit('state:snapshot', getSnapshot(state));
    socket.emit('tv:lobbyInfo', lobbyInfo);

    // Catches this socket up on an in-progress timer instead of leaving it
    // stuck with no countdown until the next tick happens to fire.
    if (state.activeGame && state.activeGame.tvTimer) {
      socket.emit('tv:timer', state.activeGame.tvTimer);
    }
  });
};
