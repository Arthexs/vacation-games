(function () {
  const MIN_PLAYERS = 3; // mirrors src/games/spyfall/server.js's MIN_PLAYERS

  function render(container) {
    container.innerHTML = '<div id="sf-admin-body"></div>';
  }

  function update(container, socket, payload, helpers) {
    const bodyEl = container.querySelector('#sf-admin-body');

    if (payload.phase === 'pending') {
      const connectedCount = helpers.getPlayers().filter((p) => p.connected).length;
      if (connectedCount < MIN_PLAYERS) {
        bodyEl.innerHTML = `<p class="status-banner waiting">Need at least ${MIN_PLAYERS} connected players to start (have ${connectedCount}).</p>`;
        return;
      }
      bodyEl.innerHTML = '<p class="subtitle">Pick the Spy:</p>';
      helpers.renderPlayerPicker(bodyEl, (playerId) => {
        socket.emit('admin:action', { type: 'assignRole', playerId });
      });
      return;
    }

    if (payload.phase === 'discussion') {
      if (payload.timer) {
        bodyEl.innerHTML = '<p class="status-banner active">Discussion timer running.</p>';
      } else {
        bodyEl.innerHTML = '<button type="button" id="sf-start-timer-btn">Start Discussion Timer</button>';
        bodyEl.querySelector('#sf-start-timer-btn').addEventListener('click', () => {
          socket.emit('admin:action', { type: 'startTimer' });
        });
      }
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
  window.__vgAdminGames.spyfall = { render, update };
})();
