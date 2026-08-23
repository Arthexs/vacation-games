const path = require('path');
const os = require('os');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');

const state = require('./src/state');
const gameRegistry = require('./src/gameRegistry');
const { gamesById } = require('./src/games');

const adminRoute = require('./src/routes/admin');
const playRoute = require('./src/routes/play');
const tvRoute = require('./src/routes/tv');

const registerAdminSocket = require('./src/sockets/adminSocket');
const registerPlayerSocket = require('./src/sockets/playerSocket');
const registerTvSocket = require('./src/sockets/tvSocket');

state.gameRegistry = gameRegistry;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/admin', adminRoute);
app.get('/play', playRoute);
app.get('/tv', tvRoute);

// Every connecting socket gets all three role handlers wired up; which room(s)
// it actually joins is decided by which *:join event the client sends.
io.on('connection', (socket) => {
  registerAdminSocket(io, socket, state, gamesById);
  registerPlayerSocket(io, socket, state, gamesById);
  registerTvSocket(io, socket, state);
});

const PORT = process.env.PORT || 3000;

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const interfaces of Object.values(nets)) {
    for (const net of interfaces) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

server.listen(PORT, async () => {
  const url = `http://${getLocalIp()}:${PORT}`;

  console.log('\n' + '='.repeat(50));
  console.log('  VACATION GAMES SERVER RUNNING');
  console.log('='.repeat(50));
  console.log(`\n  Players/TV (share this):  ${url}/play`);
  console.log(`  Admin (keep this private): ${url}/admin\n`);

  const qr = await qrcode.toString(`${url}/play`, { type: 'terminal', small: true });
  console.log(qr);
  console.log('='.repeat(50) + '\n');
});
