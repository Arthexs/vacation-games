(function () {
  function render(container) {
    container.innerHTML = '<div id="df-admin-body"></div>';
  }

  function update(container, socket, payload) {
    const bodyEl = container.querySelector('#df-admin-body');

    if (payload.phase === 'pending') {
      bodyEl.innerHTML = '<button type="button" id="df-start-timer-btn">Start Round 1</button>';
      bodyEl.querySelector('#df-start-timer-btn').addEventListener('click', () => {
        socket.emit('admin:action', { type: 'startTimer' });
      });
      return;
    }

    if (payload.phase === 'write' || payload.phase === 'draw') {
      bodyEl.innerHTML = `<p class="status-banner active">Round ${payload.currentRound + 1} of ${payload.totalRounds} in progress — no action needed.</p>`;
      return;
    }

    if (payload.phase === 'reveal') {
      bodyEl.innerHTML = '<button type="button" id="df-reveal-next-btn">Reveal Next</button>';
      bodyEl.querySelector('#df-reveal-next-btn').addEventListener('click', () => {
        socket.emit('admin:action', { type: 'revealNext' });
      });
      return;
    }

    if (payload.phase === 'vote') {
      bodyEl.innerHTML = '<p class="status-banner active">Voting in progress — no action needed.</p>';
      return;
    }

    bodyEl.innerHTML = '<p class="subtitle">Every chain has been revealed.</p>';
  }

  window.__vgAdminGames = window.__vgAdminGames || {};
  window.__vgAdminGames.drawful = { render, update };
})();
