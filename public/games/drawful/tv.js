(function () {
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(container) {
    container.innerHTML = `
      <h1>Telephone Doodles</h1>
      <div id="df-tv-body"></div>
    `;
  }

  function renderEntry(entry) {
    if (entry.type === 'write') {
      return `<li>&ldquo;${escapeHtml(entry.text)}&rdquo; <span class="subtitle">— ${escapeHtml(entry.authorName)}</span></li>`;
    }
    return `<li><img class="df-drawing" src="${entry.drawingDataUrl}" alt="A drawing"><span class="subtitle">— ${escapeHtml(entry.authorName)}</span></li>`;
  }

  function update(container, payload) {
    const bodyEl = container.querySelector('#df-tv-body');

    if (payload.phase === 'pending') {
      bodyEl.innerHTML = `<p class="status-banner waiting">Waiting for the gamemaster to start — ${payload.totalRounds || '?'} rounds of chaos incoming.</p>`;
      return;
    }

    if (payload.phase === 'write' || payload.phase === 'draw') {
      const verb = payload.phase === 'draw' ? 'drawing' : 'writing';
      bodyEl.innerHTML = `<p class="status-banner waiting">Round ${payload.currentRound + 1} of ${payload.totalRounds} — everyone is ${verb} in secret!</p>`;
      return;
    }

    if (payload.phase === 'reveal') {
      const rows = payload.entries.map(renderEntry).join('');
      bodyEl.innerHTML = `
        <p class="subtitle">Chain ${payload.chainNumber} of ${payload.totalChains} — started by ${escapeHtml(payload.ownerName)}</p>
        <ul class="clue-log">${rows}</ul>
      `;
      return;
    }

    if (payload.phase === 'vote') {
      bodyEl.innerHTML = '<p class="status-banner waiting">Everyone is voting for their favorite chain!</p>';
      return;
    }

    if (payload.phase === 'gameOver') {
      const resultsHtml = (payload.voteResults && payload.voteResults.length)
        ? `<ul class="clue-log">${payload.voteResults
          .map((r) => `<li>${escapeHtml(r.ownerName)}'s chain — ${r.votes} vote${r.votes === 1 ? '' : 's'}</li>`)
          .join('')}</ul>`
        : '';
      bodyEl.innerHTML = `<p class="status-banner active">${payload.noPlayers ? 'No players connected.' : "That's every chain!"}</p>${resultsHtml}`;
    }
  }

  window.__vgTvGames = window.__vgTvGames || {};
  window.__vgTvGames.drawful = { render, update };
})();
