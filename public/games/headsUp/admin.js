(function () {
  const MIN_PLAYERS = 2; // mirrors src/games/headsUp/server.js's MIN_PLAYERS

  function render(container) {
    container.innerHTML = '<div id="hu-admin-body"></div>';
  }

  function update(container, socket, payload, helpers) {
    const bodyEl = container.querySelector('#hu-admin-body');

    if (payload.phase === 'pending') {
      const connectedCount = helpers.getPlayers().filter((p) => p.connected).length;
      if (connectedCount < MIN_PLAYERS) {
        bodyEl.innerHTML = `<p class="status-banner waiting">Need at least ${MIN_PLAYERS} connected players (have ${connectedCount}).</p>`;
        return;
      }
      bodyEl.innerHTML = '<p class="subtitle">Hand the phone to the next Guesser, then pick them here:</p>';
      helpers.renderPlayerPicker(bodyEl, (playerId) => {
        socket.emit('admin:action', { type: 'assignRole', playerId });
      });
      return;
    }

    if (payload.phase === 'active') {
      if (payload.timer) {
        bodyEl.innerHTML = '<p class="status-banner active">Round in progress.</p>';
      } else {
        bodyEl.innerHTML = '<button type="button" id="hu-start-timer-btn">Start Timer (60s)</button>';
        bodyEl.querySelector('#hu-start-timer-btn').addEventListener('click', () => {
          socket.emit('admin:action', { type: 'startTimer' });
        });
      }
    }
  }

  window.__vgAdminGames = window.__vgAdminGames || {};
  window.__vgAdminGames.headsUp = { render, update };
})();
