(function () {
  function render(container) {
    container.innerHTML = `
      <h1>Quick Question</h1>
      <p class="subtitle" id="dq-question">Waiting for question...</p>
      <p class="status-banner" id="dq-status" hidden></p>
      <div id="dq-options"></div>
    `;
  }

  function update(container, socket, payload) {
    const questionEl = container.querySelector('#dq-question');
    const optionsEl = container.querySelector('#dq-options');
    const statusEl = container.querySelector('#dq-status');

    questionEl.textContent = payload.question;

    if (payload.resolved) {
      statusEl.hidden = false;
      statusEl.className = 'status-banner active';
      statusEl.textContent = `${payload.winnerName} got it! Waiting for the admin to end the round.`;
      optionsEl.querySelectorAll('button').forEach((btn) => { btn.disabled = true; });
      return;
    }

    statusEl.hidden = !payload.wrongGuess;
    if (payload.wrongGuess) {
      statusEl.className = 'status-banner waiting';
      statusEl.textContent = 'Not quite — watch the leaderboard, someone else might get it!';
    }

    optionsEl.innerHTML = '';
    payload.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = option;
      btn.disabled = !!payload.answered;
      btn.addEventListener('click', () => socket.emit('player:action', { optionIndex: index }));
      optionsEl.appendChild(btn);
    });
  }

  window.__vgGames = window.__vgGames || {};
  window.__vgGames.demoGame = { render, update };
})();
