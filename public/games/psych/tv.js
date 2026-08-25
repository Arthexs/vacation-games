(function () {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(container) {
    container.innerHTML = `
      <h1>Psych!</h1>
      <div id="ps-tv-body"></div>
    `;
  }

  function update(container, payload) {
    const bodyEl = container.querySelector('#ps-tv-body');

    if (payload.phase === 'pending') {
      bodyEl.innerHTML = `<p class="subtitle">${escapeHtml(payload.question)}</p><p class="status-banner waiting">Waiting for the gamemaster to start...</p>`;
      return;
    }

    if (payload.phase === 'answer') {
      bodyEl.innerHTML = `<p class="subtitle">${escapeHtml(payload.question)}</p><p class="status-banner waiting">Everyone's writing fake answers...</p>`;
      return;
    }

    if (payload.phase === 'vote') {
      const optionsHtml = payload.options.map((o) => `<li>${escapeHtml(o.text)}</li>`).join('');
      bodyEl.innerHTML = `
        <p class="subtitle">${escapeHtml(payload.question)}</p>
        <p class="subtitle">Which answer is real?</p>
        <ul class="clue-log">${optionsHtml}</ul>
      `;
      return;
    }

    if (payload.phase === 'results') {
      const rows = payload.options
        .map((o) => {
          const label = o.id === 'real'
            ? `<strong>${escapeHtml(o.text)}</strong> (real!)`
            : `${escapeHtml(o.text)} — ${escapeHtml(o.authorName || '?')}`;
          return `<li>${label} — ${o.votes} vote${o.votes === 1 ? '' : 's'}</li>`;
        })
        .join('');
      bodyEl.innerHTML = `
        <p class="subtitle">${escapeHtml(payload.question)}</p>
        <ul class="clue-log">${rows}</ul>
      `;
      return;
    }

    if (payload.phase === 'gameOver') {
      bodyEl.innerHTML = '<p class="status-banner active">No players connected.</p>';
    }
  }

  window.__vgTvGames = window.__vgTvGames || {};
  window.__vgTvGames.psych = { render, update };
})();
