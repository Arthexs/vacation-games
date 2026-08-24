(function () {
  const MIN_PLAYERS = 3; // mirrors src/games/imposter/server.js's MIN_PLAYERS

  function render(container) {
    container.innerHTML = '<div id="im-admin-body"></div>';
  }

  function update(container, socket, payload, helpers) {
    const bodyEl = container.querySelector('#im-admin-body');

    if (payload.phase === 'pending') {
      const connectedCount = helpers.getPlayers().filter((p) => p.connected).length;
      if (connectedCount < MIN_PLAYERS) {
        bodyEl.innerHTML = `<p class="status-banner waiting">Need at least ${MIN_PLAYERS} connected players to start (have ${connectedCount}).</p>`;
        return;
      }
      bodyEl.innerHTML = '<p class="subtitle">Pick the Imposter:</p>';
      helpers.renderPlayerPicker(bodyEl, (playerId) => {
        socket.emit('admin:action', { type: 'assignRole', playerId });
      });
      return;
    }

    if (payload.phase === 'clues') {
      bodyEl.innerHTML = '<p class="subtitle">Clue round in progress — no admin action needed until voting.</p>';
      return;
    }

    if (payload.phase === 'voting') {
      bodyEl.innerHTML = '<p class="subtitle">Voting in progress...</p>';
      return;
    }

    if (payload.phase === 'reveal') {
      bodyEl.innerHTML = '<p class="subtitle">Round over — end the game and start it again for another round.</p>';
    }
  }

  window.__vgAdminGames = window.__vgAdminGames || {};
  window.__vgAdminGames.imposter = { render, update };
})();
