(function () {
  // Read directly rather than threading it through render()/update() — the
  // core play.js already stores this on join for player:rejoin, so it's
  // guaranteed to be set by the time a game is active.
  const selfId = localStorage.getItem('vg_playerId');

  function render(container) {
    container.innerHTML = `
      <h1>Higher or Lower?</h1>
      <p class="subtitle">Is the next mountain taller or shorter?</p>
      <div class="hl-cards">
        <div class="hl-card">
          <img class="hl-image" id="hl-current-image" alt="">
          <p class="hl-name" id="hl-current-name"></p>
          <p class="hl-value" id="hl-current-value"></p>
        </div>
        <div class="hl-card">
          <img class="hl-image" id="hl-next-image" alt="">
          <p class="hl-name" id="hl-next-name"></p>
          <p class="hl-value" id="hl-next-value">?</p>
        </div>
      </div>
      <p class="status-banner" id="hl-status" hidden></p>
      <div class="hl-buttons">
        <button type="button" id="hl-higher-btn">▲ Higher</button>
        <button type="button" id="hl-lower-btn">▼ Lower</button>
      </div>
    `;
  }

  function setButtonsDisabled(container, disabled) {
    container.querySelector('#hl-higher-btn').disabled = disabled;
    container.querySelector('#hl-lower-btn').disabled = disabled;
  }

  function showStatus(container, className, text) {
    const statusEl = container.querySelector('#hl-status');
    statusEl.hidden = false;
    statusEl.className = `status-banner ${className}`;
    statusEl.textContent = text;
  }

  function update(container, socket, payload) {
    container.querySelector('#hl-current-image').src = payload.current.image;
    container.querySelector('#hl-current-name').textContent = payload.current.name;
    container.querySelector('#hl-current-value').textContent = `${payload.current.value.toLocaleString()} m`;

    container.querySelector('#hl-next-image').src = payload.next.image;
    container.querySelector('#hl-next-name').textContent = payload.next.name;
    const nextValueEl = container.querySelector('#hl-next-value');

    const higherBtn = container.querySelector('#hl-higher-btn');
    const lowerBtn = container.querySelector('#hl-lower-btn');

    if (payload.phase === 'guessing') {
      nextValueEl.textContent = '?';
      container.querySelector('#hl-status').hidden = true;
      setButtonsDisabled(container, false);

      const submitGuess = (guess) => {
        socket.emit('player:action', { guess });
        setButtonsDisabled(container, true);
        showStatus(container, 'waiting', 'Guess locked in — waiting for everyone else...');
      };
      higherBtn.onclick = () => submitGuess('higher');
      lowerBtn.onclick = () => submitGuess('lower');
      return;
    }

    // phase === 'reveal'
    nextValueEl.textContent = `${payload.next.value.toLocaleString()} m`;
    setButtonsDisabled(container, true);
    higherBtn.onclick = null;
    lowerBtn.onclick = null;

    const mine = payload.results[selfId];
    if (!mine) {
      showStatus(container, 'waiting', `${payload.next.name} was ${payload.actual} than ${payload.current.name}.`);
    } else if (mine.correct) {
      showStatus(container, 'active', `Correct! Streak: ${mine.streak} — +${mine.pointsEarned} points.`);
    } else {
      showStatus(container, 'waiting', `Not quite — ${payload.next.name} was ${payload.actual}. Streak reset.`);
    }
  }

  window.__vgGames = window.__vgGames || {};
  window.__vgGames.higherLower = { render, update };
})();
