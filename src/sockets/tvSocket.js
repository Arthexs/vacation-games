const { getSnapshot } = require('../broadcast');

module.exports = function registerTvSocket(io, socket, state) {
  socket.on('tv:join', () => {
    socket.join('tv');
    socket.emit('state:snapshot', getSnapshot(state));
  });
};
