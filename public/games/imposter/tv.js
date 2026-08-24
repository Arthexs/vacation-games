(function () {
  function render(container) {
    container.innerHTML = `
      <h1>Fake It Til You Make It</h1>
      <p class="subtitle" id="im-tv-subtitle"></p>
      <div id="im-tv-body"></div>
    `;
  }

  // Same clue log every player's phone already shows — no secrets in it
  // (each entry is just a name + the clue they said out loud), same
  // reasoning as Spyfall's location deck on /tv.
  function renderClueLog(clueLog) {
    if (!clueLog || !clueLog.length) return '<p class="subtitle">No clues yet.</p>';
    return `<ul class="clue-log">${clueLog
      .map((entry) => `<li><strong>${entry.name}:</strong> ${entry.clue}</li>`)
      .join('')}</ul>`;
  }

  function update(container, payload) {
    const subtitleEl = container.querySelector('#im-tv-subtitle');
    const bodyEl = container.querySelector('#im-tv-body');

    if (payload.phase === 'clues') {
      subtitleEl.textContent = payload.currentTurnName
        ? `${payload.currentTurnName}'s turn to give a clue`
        : 'Taking turns giving clues...';
      bodyEl.innerHTML = renderClueLog(payload.clueLog);
      return;
    }

    if (payload.phase === 'voting') {
      subtitleEl.textContent = 'Voting — who was the Imposter?';
      bodyEl.innerHTML = renderClueLog(payload.clueLog);
      return;
    }

    if (payload.phase === 'reveal') {
      subtitleEl.textContent = payload.outcome === 'caught'
        ? `The group caught the Imposter! ${payload.imposterName} was faking it.`
        : `The Imposter got away! ${payload.imposterName} was faking it.`;
      bodyEl.innerHTML = `
        ${renderClueLog(payload.clueLog)}
        <p class="status-banner active">The real word was <strong>${payload.word}</strong> — the Imposter had <strong>${payload.decoyWord}</strong>.</p>
      `;
    }
  }

  window.__vgTvGames = window.__vgTvGames || {};
  window.__vgTvGames.imposter = { render, update };
})();
