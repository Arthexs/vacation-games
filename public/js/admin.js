const socket = io();

const gameListEl = document.getElementById('gameList');
const leaderboardEl = document.getElementById('leaderboard');
const startPartySection = document.getElementById('startPartySection');
const startPartyBtn = document.getElementById('startPartyBtn');
const gamePickerSection = document.getElementById('gamePickerSection');
const activeGameSection = document.getElementById('activeGameSection');
const activeGameBanner = document.getElementById('activeGameBanner');
const endGameBtn = document.getElementById('endGameBtn');

let gameRegistry = [];
let partyStarted = false;
let activeGame = null;

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

startPartyBtn.addEventListener('click', () => socket.emit('admin:startParty'));
endGameBtn.addEventListener('click', () => socket.emit('admin:endGame'));

socket.on('connect', () => socket.emit('admin:join'));

socket.on('state:snapshot', (snapshot) => {
  gameRegistry = snapshot.gameRegistry;
  partyStarted = snapshot.partyStarted;
  activeGame = snapshot.activeGame;
  renderGameList();
  renderLeaderboard(snapshot.players);
  renderSections();
});

socket.on('state:leaderboard', renderLeaderboard);

socket.on('state:activeGame', (newActiveGame) => {
  activeGame = newActiveGame;
  renderSections();
});

socket.on('state:partyStarted', (newPartyStarted) => {
  partyStarted = newPartyStarted;
  renderSections();
});
