(function () {
  function render(container) {
    container.innerHTML = '<div id="ps-admin-body"></div>';
  }

  function update(container, socket, payload) {
    const bodyEl = container.querySelector('#ps-admin-body');

    if (payload.phase === 'pending') {
      bodyEl.innerHTML = '<button type="button" id="ps-start-timer-btn">Start Timer</button>';
      bodyEl.querySelector('#ps-start-timer-btn').addEventListener('click', () => {
        socket.emit('admin:action', { type: 'startTimer' });
      });
      return;
    }

    // Every phase after the first question's answer-writing timer auto-chains
    // (vote, results, and every question after the first) — no admin action
    // needed until the admin ends the game.
    bodyEl.innerHTML = '<p class="subtitle">Round in progress — no action needed until the game ends.</p>';
  }

  window.__vgAdminGames = window.__vgAdminGames || {};
  window.__vgAdminGames.psych = { render, update };
})();
