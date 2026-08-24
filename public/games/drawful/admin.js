(function () {
  function render(container) {
    container.innerHTML = '<div id="df-admin-body"></div>';
  }

  function update(container, socket, payload) {
    const bodyEl = container.querySelector('#df-admin-body');

    if (payload.phase === 'draw') {
      if (payload.timer) {
        bodyEl.innerHTML = '<p class="status-banner active">Drawing time in progress.</p>';
      } else {
        bodyEl.innerHTML = '<button type="button" id="df-start-timer-btn">Start Drawing Timer</button>';
        bodyEl.querySelector('#df-start-timer-btn').addEventListener('click', () => {
          socket.emit('admin:action', { type: 'startTimer' });
        });
      }
      return;
    }

    // Title/vote timers auto-start for every drawing — no admin action
    // needed between the draw phase and the game ending.
    bodyEl.innerHTML = '<p class="subtitle">Reveal in progress — no action needed until the game ends.</p>';
  }

  window.__vgAdminGames = window.__vgAdminGames || {};
  window.__vgAdminGames.drawful = { render, update };
})();
