(function () {
  function render(container) {
    container.innerHTML = `
      <h1>Heads Up!</h1>
      <p class="subtitle" id="hu-tv-subtitle"></p>
      <p class="hu-word" id="hu-tv-count"></p>
    `;
  }

  // Never the word itself — see src/games/headsUp/server.js's top comment.
  // guesserName/correctCount are both things the room already knows first-
  // hand (the admin handed them the phone in front of everyone; every
  // "Correct!" was called out loud before the Guesser tapped the button).
  function update(container, payload) {
    const subtitleEl = container.querySelector('#hu-tv-subtitle');
    const countEl = container.querySelector('#hu-tv-count');
    subtitleEl.textContent = payload.guesserName ? `${payload.guesserName} is guessing!` : 'Guessing in progress!';
    countEl.textContent = `${payload.correctCount} correct so far`;
  }

  window.__vgTvGames = window.__vgTvGames || {};
  window.__vgTvGames.headsUp = { render, update };
})();
