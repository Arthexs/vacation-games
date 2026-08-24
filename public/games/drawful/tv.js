(function () {
  function render(container) {
    container.innerHTML = `
      <h1>Doodle Deception</h1>
      <div id="df-tv-body"></div>
    `;
  }

  function update(container, payload) {
    const bodyEl = container.querySelector('#df-tv-body');

    if (payload.phase === 'title') {
      bodyEl.innerHTML = `<img class="df-drawing" src="${payload.drawingDataUrl}" alt="A drawing"><p class="status-banner waiting">Everyone's writing fake titles...</p>`;
      return;
    }

    if (payload.phase === 'vote') {
      const optionsHtml = payload.options.map((o) => `<li>${o.text}</li>`).join('');
      bodyEl.innerHTML = `
        <img class="df-drawing" src="${payload.drawingDataUrl}" alt="A drawing">
        <p class="subtitle">Which title is real?</p>
        <ul class="clue-log">${optionsHtml}</ul>
      `;
      return;
    }

    if (payload.phase === 'drawingResult') {
      const rows = payload.options
        .map((o) => {
          const label = o.id === 'real' ? `<strong>${o.text}</strong> (real!)` : `${o.text} — ${o.authorName || '?'}`;
          return `<li>${label} — ${o.votes} vote${o.votes === 1 ? '' : 's'}</li>`;
        })
        .join('');
      bodyEl.innerHTML = `
        <img class="df-drawing" src="${payload.drawingDataUrl}" alt="A drawing">
        <p class="status-banner active">${payload.artistName}'s drawing: "${payload.realTitle}"</p>
        <ul class="clue-log">${rows}</ul>
      `;
    }
  }

  window.__vgTvGames = window.__vgTvGames || {};
  window.__vgTvGames.drawful = { render, update };
})();
