(function () {
  const selfId = localStorage.getItem('vg_playerId');

  let hasGuessed = false;
  let hasBet = false;
  let seenPhaseKey = null; // `${phase}|${question}` — resets the flags above on a new phase/question
  let timerInterval = null;

  function render(container) {
    container.innerHTML = `
      <h1>Wits &amp; Wagers</h1>
      <p class="subtitle" id="ww-question"></p>
      <p class="timer-inline" id="ww-timer" hidden></p>
      <div id="ww-body"></div>
    `;
  }

  function stopTimerDisplay(container) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    container.querySelector('#ww-timer').hidden = true;
  }

  function startTimerDisplay(container, { startedAt, durationMs, label }) {
    const timerEl = container.querySelector('#ww-timer');
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

  function renderGuessing(container, socket) {
    const bodyEl = container.querySelector('#ww-body');
    if (hasGuessed) {
      bodyEl.innerHTML = '<p class="status-banner waiting">Guess locked in — waiting for the gamemaster...</p>';
      return;
    }
    bodyEl.innerHTML = `
      <input type="number" id="ww-guess-input" placeholder="Your guess...">
      <button type="button" id="ww-guess-btn">Lock In Guess</button>
    `;
    bodyEl.querySelector('#ww-guess-btn').addEventListener('click', () => {
      const input = bodyEl.querySelector('#ww-guess-input');
      const value = Number(input.value);
      if (!Number.isFinite(value) || input.value.trim() === '') return;
      socket.emit('player:action', { guess: value });
      hasGuessed = true;
      renderGuessing(container, socket);
    });
  }

  function renderBetting(container, socket, payload, helpers) {
    const bodyEl = container.querySelector('#ww-body');
    if (hasBet) {
      bodyEl.innerHTML = '<p class="status-banner waiting">Bet placed — waiting for the gamemaster...</p>';
      return;
    }

    const me = helpers.getPlayers().find((p) => p.id === selfId);
    const maxWager = me ? me.score : 0;

    const slotsHtml = payload.slots
      .map((slot, i) => `<button type="button" class="ww-slot-btn" data-index="${i}">${slot.value} — ${slot.playerNames.join(', ')}</button>`)
      .join('');

    bodyEl.innerHTML = `
      <p class="subtitle">Bet on the guess you think is closest without going over:</p>
      <div class="ww-slots">${slotsHtml}</div>
      <div id="ww-wager-area" hidden>
        <input type="number" id="ww-wager-input" min="1" max="${maxWager}" placeholder="Wager (max ${maxWager})">
        <button type="button" id="ww-confirm-bet-btn">Place Bet</button>
      </div>
    `;

    let selectedSlot = null;
    bodyEl.querySelectorAll('.ww-slot-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        bodyEl.querySelectorAll('.ww-slot-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedSlot = payload.slots[Number(btn.dataset.index)];
        bodyEl.querySelector('#ww-wager-area').hidden = false;
      });
    });

    bodyEl.querySelector('#ww-confirm-bet-btn').addEventListener('click', () => {
      if (!selectedSlot) return;
      const input = bodyEl.querySelector('#ww-wager-input');
      const amount = Math.floor(Number(input.value));
      if (!Number.isFinite(amount) || amount < 1 || amount > maxWager) return;
      socket.emit('player:action', { betOnPlayerId: selectedSlot.playerIds[0], amount });
      hasBet = true;
      renderBetting(container, socket, payload, helpers);
    });
  }

  function renderReveal(container, payload) {
    const bodyEl = container.querySelector('#ww-body');
    if (payload.noGuesses) {
      bodyEl.innerHTML = `<p class="status-banner waiting">Nobody guessed in time. The answer was <strong>${payload.answer}</strong>.</p>`;
      return;
    }
    const mine = payload.results ? payload.results[selfId] : null;
    let mineHtml = '';
    if (mine) {
      mineHtml = mine.won
        ? `<p class="status-banner active">You won! +${mine.payout} points.</p>`
        : '<p class="status-banner waiting">Your bet didn\'t pay off this time.</p>';
    }
    bodyEl.innerHTML = `
      <p class="subtitle">The answer was <strong>${payload.answer}</strong>. Closest without going over: <strong>${payload.winningValue}</strong>.</p>
      ${mineHtml}
    `;
  }

  function update(container, socket, payload, helpers) {
    container.querySelector('#ww-question').textContent = payload.question || '';

    const phaseKey = `${payload.phase}|${payload.question}`;
    if (phaseKey !== seenPhaseKey) {
      seenPhaseKey = phaseKey;
      if (payload.phase === 'guessing') hasGuessed = false;
      if (payload.phase === 'betting') hasBet = false;
    }

    if (payload.phase === 'guessing') {
      if (payload.timer) startTimerDisplay(container, payload.timer);
      renderGuessing(container, socket);
      return;
    }

    if (payload.phase === 'betting') {
      if (payload.timer) startTimerDisplay(container, payload.timer);
      renderBetting(container, socket, payload, helpers);
      return;
    }

    if (payload.phase === 'reveal') {
      stopTimerDisplay(container);
      renderReveal(container, payload);
    }
  }

  window.__vgGames = window.__vgGames || {};
  window.__vgGames.witsAndWagers = { render, update };
})();
