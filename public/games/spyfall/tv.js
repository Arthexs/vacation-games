(function () {
  function render(container) {
    container.innerHTML = `
      <h1>Spyfall</h1>
      <p class="subtitle" id="sf-tv-subtitle"></p>
      <div id="sf-tv-body"></div>
    `;
  }

  // Same list every player already has (the Spy's location deck, the non-spy
  // players' physical reference in real Spyfall) — showing it on /tv just
  // saves everyone from re-typing it out loud. Not itself a secret; the
  // actual location only gets highlighted once phase is 'reveal'.
  //
  // A square-ish NxN grid (columns = roundup(sqrt(count))) reads better on a
  // TV than a variable-width auto-fit flow, and stays predictable regardless
  // of how wide the surrounding card ends up being.
  function renderLocationGrid(container, locationNames, actualName) {
    const bodyEl = container.querySelector('#sf-tv-body');
    const cols = Math.max(1, Math.ceil(Math.sqrt(locationNames.length)));
    const items = locationNames
      .map((name) => `<li class="${name === actualName ? 'sf-location-actual' : ''}">${name}</li>`)
      .join('');
    bodyEl.innerHTML = `<ul class="sf-location-grid" style="grid-template-columns: repeat(${cols}, 1fr);">${items}</ul>`;
  }

  function update(container, payload) {
    const subtitleEl = container.querySelector('#sf-tv-subtitle');

    if (payload.phase === 'discussion') {
      subtitleEl.textContent = 'Possible locations — one of these is the real one:';
      renderLocationGrid(container, payload.locations);
      return;
    }

    if (payload.phase === 'voting') {
      subtitleEl.textContent = 'Voting — who was the Spy?';
      renderLocationGrid(container, payload.locations);
      return;
    }

    if (payload.phase === 'reveal') {
      const outcomeText = {
        caught: `The group caught the Spy! ${payload.spyName} was the Spy.`,
        escaped: `The Spy got away! ${payload.spyName} was the Spy.`,
        guessedLocation: `${payload.spyName} (the Spy) correctly guessed the location!`,
      }[payload.outcome] || 'Round over.';
      subtitleEl.textContent = outcomeText;
      renderLocationGrid(container, payload.locations, payload.location);
    }
  }

  window.__vgTvGames = window.__vgTvGames || {};
  window.__vgTvGames.spyfall = { render, update };
})();
