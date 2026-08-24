(function () {
  function render(container) {
    container.innerHTML = `
      <h1>Wits &amp; Wagers</h1>
      <p class="subtitle" id="ww-tv-question"></p>
      <div id="ww-tv-body"></div>
    `;
  }

  function update(container, payload) {
    container.querySelector('#ww-tv-question').textContent = payload.question || '';
    const bodyEl = container.querySelector('#ww-tv-body');

    if (payload.phase === 'guessing') {
      bodyEl.innerHTML = '<p class="status-banner waiting">Everyone\'s locking in a guess...</p>';
      return;
    }

    if (payload.phase === 'betting') {
      bodyEl.innerHTML = `<ul class="leaderboard-list">${payload.slots
        .map((slot) => `<li><span class="name">${slot.playerNames.join(', ')}</span><span class="score">${slot.value}</span></li>`)
        .join('')}</ul>`;
      return;
    }

    if (payload.phase === 'reveal') {
      if (payload.noGuesses) {
        bodyEl.innerHTML = `<p class="status-banner waiting">Nobody guessed in time. The answer was ${payload.answer}.</p>`;
        return;
      }
      const resultRows = Object.values(payload.results || {})
        .map((r) => `<li><span class="name">${r.name} bet ${r.amount}</span><span class="score">${r.won ? `+${r.payout}` : '—'}</span></li>`)
        .join('');
      bodyEl.innerHTML = `
        <p class="status-banner active">Answer: ${payload.answer} — closest without going over: ${payload.winningValue}</p>
        <ul class="leaderboard-list">${resultRows}</ul>
      `;
    }
  }

  window.__vgTvGames = window.__vgTvGames || {};
  window.__vgTvGames.witsAndWagers = { render, update };
})();
