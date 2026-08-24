(function () {
  function render(container) {
    container.innerHTML = `
      <h1>Wavelength</h1>
      <p class="subtitle" id="wl-tv-spectrum"></p>
      <p class="status-banner" id="wl-tv-clue" hidden></p>
      <div id="wl-tv-scale"></div>
    `;
  }

  function markerPercent(value) {
    return ((value - 1) / 9) * 100;
  }

  function update(container, payload) {
    container.querySelector('#wl-tv-spectrum').textContent = `${payload.left} ←→ ${payload.right}`;
    const clueEl = container.querySelector('#wl-tv-clue');
    const scaleEl = container.querySelector('#wl-tv-scale');

    if (payload.clue) {
      clueEl.hidden = false;
      clueEl.textContent = `Clue: "${payload.clue}"`;
    } else {
      clueEl.hidden = true;
    }

    if (payload.phase !== 'reveal') {
      scaleEl.innerHTML = '';
      return;
    }

    const guessMarkers = Object.values(payload.results || {})
      .map((r) => `<div class="wl-marker" style="left:${markerPercent(r.guess)}%"><span class="wl-marker-label">${r.name}</span></div>`)
      .join('');
    scaleEl.innerHTML = `
      <div class="wl-scale-track">
        <div class="wl-marker target" style="left:${markerPercent(payload.target)}%"><span class="wl-marker-label">Target</span></div>
        ${guessMarkers}
      </div>
    `;
  }

  window.__vgTvGames = window.__vgTvGames || {};
  window.__vgTvGames.wavelength = { render, update };
})();
