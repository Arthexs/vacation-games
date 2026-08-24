const socket = io();

const lobbySection = document.getElementById('lobbySection');
const leaderboardSection = document.getElementById('leaderboardSection');
const gameContentSection = document.getElementById('gameContentSection');
const qrImage = document.getElementById('qrImage');
const joinUrlText = document.getElementById('joinUrlText');
const playerCountText = document.getElementById('playerCountText');
const lobbyPlayerList = document.getElementById('lobbyPlayerList');
const leaderboardEl = document.getElementById('leaderboard');
const timerBanner = document.getElementById('timerBanner');
const timerLabelEl = document.getElementById('timerLabel');
const timerValueEl = document.getElementById('timerValue');

let players = [];
let partyStarted = false;

// Each public/games/<id>/tv.js registers itself here on load, e.g.:
//   window.__vgTvGames['drawful'] = { render(container), update(container, payload) }
// No socket is passed through — /tv is purely passive, it never emits actions.
window.__vgTvGames = window.__vgTvGames || {};
const loadedTvGameScripts = new Set();
let timerInterval = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderLobbyPlayers() {
  const connectedCount = players.filter((p) => p.connected).length;
  playerCountText.textContent = `${connectedCount} player${connectedCount === 1 ? '' : 's'} connected`;

  lobbyPlayerList.innerHTML = '';
  players.forEach((p) => {
    const li = document.createElement('li');
    if (!p.connected) li.classList.add('disconnected');
    li.textContent = p.name;
    lobbyPlayerList.appendChild(li);
  });
}

function renderLeaderboard() {
  leaderboardEl.innerHTML = '';
  players.forEach((p) => {
    const li = document.createElement('li');
    if (!p.connected) li.classList.add('disconnected');
    li.innerHTML = `<span class="rank">#${p.rank}</span><span class="name">${escapeHtml(p.name)}</span><span class="score">${p.score}</span>`;
    leaderboardEl.appendChild(li);
  });
}

// Three mutually exclusive sections. A game's tv:content takeover (gameContent)
// wins over the default lobby/leaderboard choice until it's cleared.
function showSection(section) {
  lobbySection.hidden = section !== 'lobby';
  leaderboardSection.hidden = section !== 'leaderboard';
  gameContentSection.hidden = section !== 'gameContent';
}

function showDefaultSection() {
  showSection(partyStarted ? 'leaderboard' : 'lobby');
}

// Loaded on demand so adding a new game's tv.js never requires editing this file.
function loadTvGameScript(gameId, onReady) {
  if (loadedTvGameScripts.has(gameId)) {
    onReady();
    return;
  }
  const script = document.createElement('script');
  script.src = `/games/${gameId}/tv.js`;
  script.onload = () => {
    loadedTvGameScripts.add(gameId);
    onReady();
  };
  document.head.appendChild(script);
}

function stopTimerDisplay() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  timerBanner.hidden = true;
}

// Ticks locally from the server's {startedAt, durationMs} — the server's own
// setTimeout (src/timer.js) is what actually ends the round, this is just display.
function startTimerDisplay({ startedAt, durationMs, label }) {
  timerLabelEl.textContent = label || '';
  timerBanner.hidden = false;

  function tick() {
    const remainingMs = Math.max(0, startedAt + durationMs - Date.now());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    timerValueEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    if (remainingMs <= 0) stopTimerDisplay();
  }

  if (timerInterval) clearInterval(timerInterval);
  tick();
  timerInterval = setInterval(tick, 250);
}

socket.on('connect', () => socket.emit('tv:join'));

socket.on('tv:lobbyInfo', ({ joinUrl, qrDataUrl }) => {
  qrImage.src = qrDataUrl;
  joinUrlText.textContent = joinUrl;
});

socket.on('state:snapshot', (snapshot) => {
  players = snapshot.players;
  partyStarted = snapshot.partyStarted;
  renderLobbyPlayers();
  renderLeaderboard();
  showDefaultSection();
});

socket.on('state:leaderboard', (updatedPlayers) => {
  players = updatedPlayers;
  renderLobbyPlayers();
  renderLeaderboard();
});

socket.on('state:partyStarted', (newPartyStarted) => {
  partyStarted = newPartyStarted;
  // A game's tv:content takeover (if any) stays up regardless of party state.
  if (gameContentSection.hidden) showDefaultSection();
});

// Every game's rules are just a title plus some bullet text, so this is
// rendered generically here rather than needing a per-game tv.js just for
// it — see GAME_PLANS.md's "Rules display" core addition. admin:selectGame
// pushes this briefly, then hands /tv back to whatever the game shows next.
function renderRulesBanner(payload) {
  const rulesHtml = (payload.rules || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
  gameContentSection.innerHTML = `
    <h1>${escapeHtml(payload.title || '')}</h1>
    <ul class="rules-list">${rulesHtml}</ul>
  `;
}

socket.on('tv:content', (content) => {
  if (!content) {
    showDefaultSection();
    return;
  }
  const { gameId, payload } = content;
  if (payload && payload.type === 'rules') {
    gameContentSection.innerHTML = '';
    renderRulesBanner(payload);
    showSection('gameContent');
    return;
  }
  loadTvGameScript(gameId, () => {
    const handlers = window.__vgTvGames[gameId];
    if (!handlers) return;
    gameContentSection.innerHTML = '';
    if (handlers.render) handlers.render(gameContentSection);
    if (handlers.update) handlers.update(gameContentSection, payload);
    showSection('gameContent');
  });
});

socket.on('tv:timer', (payload) => {
  if (!payload) {
    stopTimerDisplay();
    return;
  }
  startTimerDisplay(payload);
});