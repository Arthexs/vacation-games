const socket = io();

const gameListEl = document.getElementById('gameList');
const leaderboardEl = document.getElementById('leaderboard');
const startPartySection = document.getElementById('startPartySection');
const startPartyBtn = document.getElementById('startPartyBtn');
const gamePickerSection = document.getElementById('gamePickerSection');
const activeGameSection = document.getElementById('activeGameSection');
const activeGameBanner = document.getElementById('activeGameBanner');
const endGameBtn = document.getElementById('endGameBtn');
const gameControlSection = document.getElementById('gameControlSection');

let gameRegistry = [];
let partyStarted = false;
let activeGame = null;
let players = [];

// Each public/games/<id>/admin.js registers itself here on load, e.g.:
//   window.__vgAdminGames['spyfall'] = {
//     render(container, socket, helpers), update(container, socket, payload, helpers)
//   }
// Optional — most games don't need an admin-in-the-loop step and never load one.
window.__vgAdminGames = window.__vgAdminGames || {};
const loadedGameAdminScripts = new Set();
const failedGameAdminScripts = new Set();

let currentAdminGameId = null;
let lastGameUpdatePayload = null;

// Shared so a game's own admin.js doesn't need to rebuild player-list
// rendering itself — reads the live `players` list via closure, so it always
// reflects who's currently connected, not a stale snapshot from render time.
const adminHelpers = {
  getPlayers: () => players,
  renderPlayerPicker(container, onPick) {
    const ul = document.createElement('ul');
    ul.className = 'player-picker';
    players.filter((p) => p.connected).forEach((p) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = p.name;
      btn.addEventListener('click', () => onPick(p.id));
      li.appendChild(btn);
      ul.appendChild(li);
    });
    container.appendChild(ul);
  },
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderLeaderboard(players) {
  leaderboardEl.innerHTML = '';
  players.forEach((p) => {
    const li = document.createElement('li');
    if (!p.connected) li.classList.add('disconnected');
    li.innerHTML = `<span class="rank">#${p.rank}</span><span class="name">${escapeHtml(p.name)}</span><span class="score">${p.score}</span>`;

    const scoreInput = document.createElement('input');
    scoreInput.type = 'number';
    scoreInput.className = 'score-override-input';
    scoreInput.value = p.score;

    const setBtn = document.createElement('button');
    setBtn.type = 'button';
    setBtn.className = 'score-override-btn';
    setBtn.textContent = 'Set';
    setBtn.addEventListener('click', () => {
      const score = Number(scoreInput.value);
      if (!Number.isFinite(score)) return;
      socket.emit('admin:setScore', { playerId: p.id, score });
    });

    li.appendChild(scoreInput);
    li.appendChild(setBtn);
    leaderboardEl.appendChild(li);
  });
}

function renderGameList() {
  gameListEl.innerHTML = '';
  gameRegistry.forEach((game) => {
    const li = document.createElement('li');
    li.innerHTML = `<h3>${escapeHtml(game.title)}</h3><p>${escapeHtml(game.description)}</p>`;
    const btn = document.createElement('button');
    btn.textContent = 'Start';
    btn.addEventListener('click', () => socket.emit('admin:selectGame', { gameId: game.id }));
    li.appendChild(btn);
    gameListEl.appendChild(li);
  });
}

// Three mutually exclusive sections: start-party (before the party begins),
// game picker (party started, no game running), active-game banner (a game is running).
function renderSections() {
  startPartySection.hidden = partyStarted;

  if (!partyStarted) {
    activeGameSection.hidden = true;
    gamePickerSection.hidden = true;
    return;
  }

  if (activeGame) {
    const game = gameRegistry.find((g) => g.id === activeGame.gameId);
    activeGameBanner.textContent = `Now playing: ${game ? game.title : activeGame.gameId}`;
    activeGameSection.hidden = false;
    gamePickerSection.hidden = true;
  } else {
    activeGameSection.hidden = true;
    gamePickerSection.hidden = false;
  }
}

// Loaded on demand so a game without an admin.js never fails silently loud —
// script.onerror just means this game has no admin-in-the-loop step.
function loadGameAdminScript(gameId, onReady, onError) {
  if (failedGameAdminScripts.has(gameId)) {
    onError();
    return;
  }
  if (loadedGameAdminScripts.has(gameId)) {
    onReady();
    return;
  }
  const script = document.createElement('script');
  script.src = `/games/${gameId}/admin.js`;
  script.onload = () => {
    loadedGameAdminScripts.add(gameId);
    onReady();
  };
  script.onerror = () => {
    failedGameAdminScripts.add(gameId);
    script.remove();
    onError();
  };
  document.head.appendChild(script);
}

function clearGameAdmin() {
  currentAdminGameId = null;
  lastGameUpdatePayload = null;
  gameControlSection.hidden = true;
  gameControlSection.innerHTML = '';
}

// Re-invoked (not a full render) on every game:update/state:leaderboard so a
// game's admin controls (e.g. "Start Timer" only once a phase allows it, the
// player picker reflecting who's connected right now) stay current without
// wiping whatever local UI state the game's own admin.js is keeping.
function updateGameAdmin() {
  if (!currentAdminGameId || !lastGameUpdatePayload) return;
  const handlers = window.__vgAdminGames[currentAdminGameId];
  if (handlers && handlers.update) handlers.update(gameControlSection, socket, lastGameUpdatePayload, adminHelpers);
}

function enterGameAdmin(gameId) {
  currentAdminGameId = gameId;
  lastGameUpdatePayload = null;
  loadGameAdminScript(gameId, () => {
    const handlers = window.__vgAdminGames[gameId];
    if (!handlers) {
      clearGameAdmin();
      return;
    }
    gameControlSection.innerHTML = '';
    gameControlSection.hidden = false;
    if (handlers.render) handlers.render(gameControlSection, socket, adminHelpers);
    updateGameAdmin();
  }, clearGameAdmin);
}

startPartyBtn.addEventListener('click', () => socket.emit('admin:startParty'));
endGameBtn.addEventListener('click', () => socket.emit('admin:endGame'));

socket.on('connect', () => socket.emit('admin:join'));

socket.on('state:snapshot', (snapshot) => {
  gameRegistry = snapshot.gameRegistry;
  partyStarted = snapshot.partyStarted;
  activeGame = snapshot.activeGame;
  players = snapshot.players;
  renderGameList();
  renderLeaderboard(snapshot.players);
  renderSections();
  if (activeGame) enterGameAdmin(activeGame.gameId);
});

socket.on('state:leaderboard', (updatedPlayers) => {
  players = updatedPlayers;
  renderLeaderboard(updatedPlayers);
  updateGameAdmin();
});

socket.on('state:activeGame', (newActiveGame) => {
  activeGame = newActiveGame;
  if (activeGame) enterGameAdmin(activeGame.gameId);
  else clearGameAdmin();
  renderSections();
});

socket.on('state:partyStarted', (newPartyStarted) => {
  partyStarted = newPartyStarted;
  renderSections();
});

socket.on('game:update', (payload) => {
  lastGameUpdatePayload = payload;
  updateGameAdmin();
});
