const socket = io();

const gameListEl = document.getElementById('gameList');
const leaderboardEl = document.getElementById('leaderboard');
const gamePickerSection = document.getElementById('gamePickerSection');
const activeGameSection = document.getElementById('activeGameSection');
const activeGameBanner = document.getElementById('activeGameBanner');
const endGameBtn = document.getElementById('endGameBtn');

let gameRegistry = [];

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderLeaderboard(players) {
  leaderboardEl.innerHTML = '';
  players.forEach((p, i) => {
    const li = document.createElement('li');
    if (!p.connected) li.classList.add('disconnected');
    li.innerHTML = `<span class="rank">#${i + 1}</span><span class="name">${escapeHtml(p.name)}</span><span class="score">${p.score}</span>`;
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

function renderActiveGame(activeGame) {
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

endGameBtn.addEventListener('click', () => socket.emit('admin:endGame'));

socket.on('connect', () => socket.emit('admin:join'));

socket.on('state:snapshot', (snapshot) => {
  gameRegistry = snapshot.gameRegistry;
  renderGameList();
  renderLeaderboard(snapshot.players);
  renderActiveGame(snapshot.activeGame);
});

socket.on('state:leaderboard', renderLeaderboard);
socket.on('state:activeGame', renderActiveGame);
