const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');

const state = require('./src/state');
const gameRegistry = require('./src/gameRegistry');
const { gamesById } = require('./src/games');
const { getLocalIp, buildLobbyInfo } = require('./src/lobbyInfo');

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
// Game content data (e.g. higherLower's mountain images) lives outside public/,
// separate from the app shell — see CLAUDE.md's "What this is".
app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/admin', adminRoute);
app.get('/play', playRoute);
app.get('/tv', tvRoute);

const PORT = process.env.PORT || 3000;

async function start() {
  // Built once before we start accepting connections, so every tv:join
  // (even the very first one) already has a ready QR image to hand back.
  const lobbyInfo = await buildLobbyInfo(PORT);

  // Every connecting socket gets all three role handlers wired up; which room(s)
  // it actually joins is decided by which *:join event the client sends.
  io.on('connection', (socket) => {
    registerAdminSocket(io, socket, state, gamesById);
    registerPlayerSocket(io, socket, state, gamesById);
    registerTvSocket(io, socket, state, lobbyInfo);
  });

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
}

start();