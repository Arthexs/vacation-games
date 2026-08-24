(function () {
  function render(container) {
    container.innerHTML = '<div id="ww-admin-body"></div>';
  }

  function update(container, socket, payload) {
    const bodyEl = container.querySelector('#ww-admin-body');

    if (payload.timer) {
      bodyEl.innerHTML = '<p class="status-banner active">Timer running.</p>';
      return;
    }

    if (payload.phase === 'guessing') {
      bodyEl.innerHTML = '<button type="button" id="ww-start-timer-btn">Start Guess Timer</button>';
    } else if (payload.phase === 'betting') {
      bodyEl.innerHTML = '<button type="button" id="ww-start-timer-btn">Start Bet Timer</button>';
    } else {
      bodyEl.innerHTML = '<p class="subtitle">Waiting for the next question...</p>';
      return;
    }
    bodyEl.querySelector('#ww-start-timer-btn').addEventListener('click', () => {
      socket.emit('admin:action', { type: 'startTimer' });
    });
  }

  window.__vgAdminGames = window.__vgAdminGames || {};
  window.__vgAdminGames.witsAndWagers = { render, update };
})();
