const socket = io();

const lobbySection = document.getElementById('lobbySection');
const leaderboardSection = document.getElementById('leaderboardSection');
const qrImage = document.getElementById('qrImage');
const joinUrlText = document.getElementById('joinUrlText');
const playerCountText = document.getElementById('playerCountText');
const lobbyPlayerList = document.getElementById('lobbyPlayerList');
const leaderboardEl = document.getElementById('leaderboard');
const timerBanner = document.getElementById('timerBanner');
const timerLabelEl = document.getElementById('timerLabel');
const timerValueEl = document.getElementById('timerValue');

let players = [];
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

function showLobby() {
  lobbySection.hidden = false;
  leaderboardSection.hidden = true;
}

function showLeaderboard() {
  lobbySection.hidden = true;
  leaderboardSection.hidden = false;
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
  renderLobbyPlayers();
  renderLeaderboard();
  if (snapshot.partyStarted) showLeaderboard();
  else showLobby();
});

socket.on('state:leaderboard', (updatedPlayers) => {
  players = updatedPlayers;
  renderLobbyPlayers();
  renderLeaderboard();
});

socket.on('state:partyStarted', (partyStarted) => {
  if (partyStarted) showLeaderboard();
  else showLobby();
});

socket.on('tv:timer', (payload) => {
  if (!payload) {
    stopTimerDisplay();
    return;
  }
  startTimerDisplay(payload);
});
