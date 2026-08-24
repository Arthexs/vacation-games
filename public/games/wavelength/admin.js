(function () {
  const MIN_PLAYERS = 2; // mirrors src/games/wavelength/server.js's MIN_PLAYERS

  function render(container) {
    container.innerHTML = '<div id="wl-admin-body"></div>';
  }

  function update(container, socket, payload, helpers) {
    const bodyEl = container.querySelector('#wl-admin-body');

    if (payload.phase === 'pending') {
      const connectedCount = helpers.getPlayers().filter((p) => p.connected).length;
      if (connectedCount < MIN_PLAYERS) {
        bodyEl.innerHTML = `<p class="status-banner waiting">Need at least ${MIN_PLAYERS} connected players (have ${connectedCount}).</p>`;
        return;
      }
      bodyEl.innerHTML = '<p class="subtitle">Pick the Clue Giver:</p>';
      helpers.renderPlayerPicker(bodyEl, (playerId) => {
        socket.emit('admin:action', { type: 'assignRole', playerId });
      });
      return;
    }

    if (payload.phase === 'clueGiving') {
      bodyEl.innerHTML = '<p class="subtitle">Waiting for the Clue Giver\'s clue...</p>';
      return;
    }

    if (payload.phase === 'guessing') {
      bodyEl.innerHTML = '<p class="subtitle">Guessing in progress — no admin action needed until everyone\'s locked in.</p>';
      return;
    }

    if (payload.phase === 'reveal') {
      bodyEl.innerHTML = '<p class="subtitle">Reveal in progress — the next round starts automatically.</p>';
    }
  }

  window.__vgAdminGames = window.__vgAdminGames || {};
  window.__vgAdminGames.wavelength = { render, update };
})();
