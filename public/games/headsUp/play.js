(function () {
  let myRole = null; // cached across update() calls, same reasoning as spyfall/imposter
  let myWord = null;
  let timerInterval = null;

  function render(container) {
    container.innerHTML = `
      <h1>Heads Up!</h1>
      <p class="subtitle" id="hu-phase-text"></p>
      <p class="timer-inline" id="hu-timer" hidden></p>
      <div id="hu-body"></div>
    `;
  }

  function stopTimerDisplay(container) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    container.querySelector('#hu-timer').hidden = true;
  }

  function startTimerDisplay(container, { startedAt, durationMs, label }) {
    const timerEl = container.querySelector('#hu-timer');
    timerEl.hidden = false;
    function tick() {
      const remainingMs = Math.max(0, startedAt + durationMs - Date.now());
      const totalSeconds = Math.ceil(remainingMs / 1000);
      timerEl.textContent = `${label || 'Time'}: ${totalSeconds}s`;
      if (remainingMs <= 0 && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
    if (timerInterval) clearInterval(timerInterval);
    tick();
    timerInterval = setInterval(tick, 250);
  }

  function renderPending(container, payload) {
    const bodyEl = container.querySelector('#hu-body');
    if (payload.lastRoundGuesserName) {
      bodyEl.innerHTML = `<p class="status-banner active">${payload.lastRoundGuesserName} got ${payload.lastRoundCorrectCount} correct! Waiting for the gamemaster to pick the next Guesser...</p>`;
    } else {
      bodyEl.innerHTML = '<p class="subtitle">Waiting for the gamemaster to pick the next Guesser...</p>';
    }
  }

  function renderActive(container, socket) {
    const bodyEl = container.querySelector('#hu-body');
    if (myRole === 'guesser') {
      // No Correct button here on purpose — the Guesser can't see the word,
      // so they have no way to judge that themselves. Bystanders (who can
      // see it and hear it get guessed) are the ones who mark it correct.
      bodyEl.innerHTML = `
        <p class="status-banner waiting">You're guessing! Everyone else can see the word — listen to their clues.</p>
        <button type="button" id="hu-pass-btn" class="secondary">Pass</button>
      `;
      bodyEl.querySelector('#hu-pass-btn').addEventListener('click', () => socket.emit('player:action', { pass: true }));
    } else {
      bodyEl.innerHTML = `
        <p class="hu-word">${myWord || '...'}</p>
        <p class="subtitle">Give clues without saying the word!</p>
        <button type="button" id="hu-correct-btn">✔ Correct!</button>
      `;
      bodyEl.querySelector('#hu-correct-btn').addEventListener('click', () => socket.emit('player:action', { correct: true }));
    }
  }

  function update(container, socket, payload) {
    if (payload.role) myRole = payload.role;
    if (payload.word) myWord = payload.word;

    const phaseText = container.querySelector('#hu-phase-text');

    if (payload.phase === 'pending') {
      stopTimerDisplay(container);
      myRole = null;
      myWord = null;
      phaseText.textContent = 'Between rounds';
      renderPending(container, payload);
      return;
    }

    if (payload.phase === 'active') {
      phaseText.textContent = myRole === 'guesser' ? 'Your turn to guess!' : 'Help the Guesser!';
      if (payload.timer) startTimerDisplay(container, payload.timer);
      renderActive(container, socket);
    }
  }

  window.__vgGames = window.__vgGames || {};
  window.__vgGames.headsUp = { render, update };
})();
