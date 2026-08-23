const socket = io();

const leaderboardEl = document.getElementById('leaderboard');

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
    leaderboardEl.appendChild(li);
  });
}

socket.on('connect', () => socket.emit('tv:join'));
socket.on('state:snapshot', (snapshot) => renderLeaderboard(snapshot.players));
socket.on('state:leaderboard', renderLeaderboard);
