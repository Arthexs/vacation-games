(function () {
  const selfId = localStorage.getItem('vg_playerId');

  let hasSubmittedAnswer = false;
  let hasVoted = false;
  let currentQuestionKey = null; // tracks which question's answer/vote phase we're on, to reset flags per question
  let timerInterval = null;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(container) {
    container.innerHTML = `
      <h1>Psych!</h1>
      <p class="subtitle" id="ps-status-text"></p>
      <p class="timer-inline" id="ps-timer" hidden></p>
      <div id="ps-body"></div>
    `;
  }

  function stopTimerDisplay(container) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    container.querySelector('#ps-timer').hidden = true;
  }

  function startTimerDisplay(container, { startedAt, durationMs, label }) {
    const timerEl = container.querySelector('#ps-timer');
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

  function renderAnswerPhase(bodyEl, socket, payload) {
    if (hasSubmittedAnswer) {
      bodyEl.innerHTML = '<p class="status-banner waiting">Fake answer submitted — waiting for everyone else...</p>';
      return;
    }
    bodyEl.innerHTML = `
      <p class="subtitle">${escapeHtml(payload.question)}</p>
      <input type="text" id="ps-answer-input" placeholder="Write a believable fake answer..." maxlength="80">
      <button type="button" id="ps-answer-btn">Submit</button>
    `;
    const submit = () => {
      const input = bodyEl.querySelector('#ps-answer-input');
      const fakeAnswer = input.value.trim();
      if (!fakeAnswer) return;
      socket.emit('player:action', { fakeAnswer });
      hasSubmittedAnswer = true;
      renderAnswerPhase(bodyEl, socket, payload);
    };
    bodyEl.querySelector('#ps-answer-btn').addEventListener('click', submit);
    bodyEl.querySelector('#ps-answer-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  }

  function renderVotePhase(bodyEl, socket, payload) {
    if (hasVoted) {
      bodyEl.innerHTML = `<p class="subtitle">${escapeHtml(payload.question)}</p><p class="status-banner waiting">Vote submitted — waiting for everyone else...</p>`;
      return;
    }
    const choices = payload.options.filter((o) => o.id !== selfId);
    const optionsHtml = choices
      .map((o, i) => `<button type="button" class="option-btn" data-index="${i}">${escapeHtml(o.text)}</button>`)
      .join('');
    bodyEl.innerHTML = `
      <p class="subtitle">${escapeHtml(payload.question)}</p>
      <p class="subtitle">Which answer is the real one?</p>
      <div id="ps-vote-options">${optionsHtml}</div>
    `;
    bodyEl.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const option = choices[Number(btn.dataset.index)];
        socket.emit('player:action', { vote: option.id });
        hasVoted = true;
        renderVotePhase(bodyEl, socket, payload);
      });
    });
  }

  function renderResults(bodyEl, payload) {
    const rows = payload.options
      .map((o) => {
        const label = o.id === 'real'
          ? `<strong>${escapeHtml(o.text)}</strong> (the real answer!)`
          : `${escapeHtml(o.text)} — ${escapeHtml(o.authorName || '?')}`;
        return `<li>${label} — ${o.votes} vote${o.votes === 1 ? '' : 's'}</li>`;
      })
      .join('');
    bodyEl.innerHTML = `
      <p class="subtitle">${escapeHtml(payload.question)}</p>
      <ul class="clue-log">${rows}</ul>
    `;
  }

  function update(container, socket, payload) {
    const statusText = container.querySelector('#ps-status-text');
    const bodyEl = container.querySelector('#ps-body');

    if (payload.phase === 'pending') {
      stopTimerDisplay(container);
      statusText.textContent = 'Waiting for the gamemaster to start';
      bodyEl.innerHTML = `<p class="subtitle">${escapeHtml(payload.question)}</p><p class="status-banner waiting">Get ready to write a fake answer!</p>`;
      return;
    }

    if (payload.phase === 'answer') {
      if (payload.question !== currentQuestionKey) {
        currentQuestionKey = payload.question;
        hasSubmittedAnswer = false;
        hasVoted = false;
      }
      statusText.textContent = 'Write a fake answer';
      if (payload.timer) startTimerDisplay(container, payload.timer);
      renderAnswerPhase(bodyEl, socket, payload);
      return;
    }

    if (payload.phase === 'vote') {
      statusText.textContent = 'Vote for the real answer';
      if (payload.timer) startTimerDisplay(container, payload.timer);
      renderVotePhase(bodyEl, socket, payload);
      return;
    }

    if (payload.phase === 'results') {
      stopTimerDisplay(container);
      statusText.textContent = 'Results';
      renderResults(bodyEl, payload);
      return;
    }

    if (payload.phase === 'gameOver') {
      stopTimerDisplay(container);
      statusText.textContent = 'No players connected.';
      bodyEl.innerHTML = '<p class="subtitle">Ask the gamemaster to end the game.</p>';
    }
  }

  window.__vgGames = window.__vgGames || {};
  window.__vgGames.psych = { render, update };
})();
