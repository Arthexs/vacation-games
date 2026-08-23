const socket = io();

const joinSection = document.getElementById('joinSection');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const leaderboardSection = document.getElementById('leaderboardSection');
const leaderboardEl = document.getElementById('leaderboard');
const gameSection = document.getElementById('gameSection');

// Each public/games/<id>/play.js registers itself here on load, e.g.:
//   window.__vgGames['demoGame'] = { render(container, socket), update(container, socket, payload) }
window.__vgGames = window.__vgGames || {};
const loadedGameScripts = new Set();

let playerId = localStorage.getItem('vg_playerId');
let currentGameId = null;
// Replayed into a game's update() once its script finishes loading, so a client that
// joins/reconnects mid-round doesn't miss the game:update its start() already sent.
let lastGameUpdatePayload = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showJoin() {
  joinSection.hidden = false;
  leaderboardSection.hidden = true;
  gameSection.hidden = true;
}

function showLeaderboard() {
  joinSection.hidden = true;
  leaderboardSection.hidden = false;
  gameSection.hidden = true;
}

function showGame() {
  joinSection.hidden = true;
  leaderboardSection.hidden = true;
  gameSection.hidden = false;
}

function renderLeaderboard(players) {
  leaderboardEl.innerHTML = '';
  players.forEach((p) => {
    const li = document.createElement('li');
    if (!p.connected) li.classList.add('disconnected');
    if (p.id === playerId) li.classList.add('self');
    const youTag = p.id === playerId ? ' <span class="you-tag">(you)</span>' : '';
    li.innerHTML = `<span class="rank">#${p.rank}</span><span class="name">${escapeHtml(p.name)}${youTag}</span><span class="score">${p.score}</span>`;
    leaderboardEl.appendChild(li);
  });
}

// Loaded on demand so adding a new game folder never requires editing this file.
function loadGameScript(gameId, onReady) {
  if (loadedGameScripts.has(gameId)) {
    onReady();
    return;
  }
  const script = document.createElement('script');
  script.src = `/games/${gameId}/play.js`;
  script.onload = () => {
    loadedGameScripts.add(gameId);
    onReady();
  };
  document.head.appendChild(script);
}

function enterGame(gameId) {
  currentGameId = gameId;
  loadGameScript(gameId, () => {
    const handlers = window.__vgGames[gameId];
    if (!handlers) return;
    gameSection.innerHTML = '';
    if (handlers.render) handlers.render(gameSection, socket);
    if (handlers.update && lastGameUpdatePayload) handlers.update(gameSection, socket, lastGameUpdatePayload);
    showGame();
  });
}

joinBtn.addEventListener('click', () => {
  const name = nameInput.value.trim();
  if (!name) return;
  socket.emit('player:join', { name });
});

socket.on('connect', () => {
  if (playerId) socket.emit('player:rejoin', { playerId });
});

socket.on('player:joined', ({ playerId: id }) => {
  playerId = id;
  localStorage.setItem('vg_playerId', id);
});

socket.on('player:rejoinFailed', () => {
  playerId = null;
  localStorage.removeItem('vg_playerId');
  showJoin();
});

socket.on('state:snapshot', (snapshot) => {
  renderLeaderboard(snapshot.players);
  if (snapshot.activeGame) {
    enterGame(snapshot.activeGame.gameId);
  } else {
    showLeaderboard();
  }
});

socket.on('state:leaderboard', renderLeaderboard);

socket.on('state:activeGame', (activeGame) => {
  if (activeGame) {
    enterGame(activeGame.gameId);
  } else {
    currentGameId = null;
    lastGameUpdatePayload = null;
    showLeaderboard();
  }
});

socket.on('game:update', (payload) => {
  lastGameUpdatePayload = payload;
  if (!currentGameId) return;
  const handlers = window.__vgGames[currentGameId];
  if (handlers && handlers.update) handlers.update(gameSection, socket, payload);
});

if (!playerId) showJoin();
