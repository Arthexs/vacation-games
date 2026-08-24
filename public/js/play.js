const socket = io();

const joinSection = document.getElementById('joinSection');
const nameInput = document.getElementById('nameInput');
const joinBtn = document.getElementById('joinBtn');
const leaderboardSection = document.getElementById('leaderboardSection');
const leaderboardEl = document.getElementById('leaderboard');
const gameSection = document.getElementById('gameSection');
const rulesBtn = document.getElementById('rulesBtn');
const rulesModal = document.getElementById('rulesModal');
const rulesModalTitle = document.getElementById('rulesModalTitle');
const rulesModalList = document.getElementById('rulesModalList');
const rulesModalCloseBtn = document.getElementById('rulesModalCloseBtn');
const countdownOverlay = document.getElementById('countdownOverlay');

// Each public/games/<id>/play.js registers itself here on load, e.g.:
//   window.__vgGames['demoGame'] = { render(container, socket, helpers), update(container, socket, payload, helpers) }
window.__vgGames = window.__vgGames || {};
const loadedGameScripts = new Set();

let playerId = localStorage.getItem('vg_playerId');
let currentGameId = null;
// Populated from state:activeGame/state:snapshot's activeGame payload —
// see GAME_PLANS.md's "Rules display" core addition — so the "?" button
// works immediately even for a player who joins/reconnects mid-game.
let currentGameTitle = null;
let currentGameRules = null;
// Replayed into a game's update() once its script finishes loading, so a client that
// joins/reconnects mid-round doesn't miss the game:update its start() already sent.
let lastGameUpdatePayload = null;
let players = [];

// A game whose UI needs to show/pick other players (Spyfall/Imposter's vote,
// Heads Up!'s spectator list) needs the current player list, which nothing
// exposed to a game module before — mirrors admin.js's helpers.renderPlayerPicker.
// getSelfId reads the live `playerId` (set from this socket's own
// player:joined/rejoin, not re-read from localStorage) rather than a game
// module caching its own copy at script-load time — several tabs of the same
// browser share one localStorage, so a game that cached
// localStorage.getItem('vg_playerId') once could end up comparing against
// whichever tab joined last instead of its own actual identity.
const gameHelpers = { getPlayers: () => players, getSelfId: () => playerId };

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

function setActiveGameChrome(activeGame) {
  currentGameTitle = activeGame ? activeGame.title : null;
  currentGameRules = activeGame ? activeGame.rules : null;
  rulesBtn.hidden = !activeGame;
  if (!activeGame) rulesModal.hidden = true;
}

function openRulesModal() {
  rulesModalTitle.textContent = currentGameTitle || '';
  rulesModalList.innerHTML = (currentGameRules || [])
    .map((rule) => `<li>${escapeHtml(rule)}</li>`)
    .join('');
  rulesModal.hidden = false;
}

rulesBtn.addEventListener('click', openRulesModal);
rulesModalCloseBtn.addEventListener('click', () => { rulesModal.hidden = true; });
rulesModal.addEventListener('click', (e) => {
  if (e.target === rulesModal) rulesModal.hidden = true;
});

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
    if (handlers.render) handlers.render(gameSection, socket, gameHelpers);
    if (handlers.update && lastGameUpdatePayload) handlers.update(gameSection, socket, lastGameUpdatePayload, gameHelpers);
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
  players = snapshot.players;
  renderLeaderboard(snapshot.players);
  setActiveGameChrome(snapshot.activeGame);
  if (snapshot.activeGame) {
    lastGameUpdatePayload = snapshot.activeGame.lastUpdate;
    enterGame(snapshot.activeGame.gameId);
  } else {
    showLeaderboard();
  }
});

socket.on('state:leaderboard', (updatedPlayers) => {
  players = updatedPlayers;
  renderLeaderboard(updatedPlayers);
});

socket.on('state:activeGame', (activeGame) => {
  setActiveGameChrome(activeGame);
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
  if (handlers && handlers.update) handlers.update(gameSection, socket, payload, gameHelpers);
});

socket.on('countdown:tick', (secondsLeft) => {
  if (!secondsLeft) {
    countdownOverlay.hidden = true;
    return;
  }
  countdownOverlay.hidden = false;
  countdownOverlay.textContent = secondsLeft;
});

if (!playerId) showJoin();
