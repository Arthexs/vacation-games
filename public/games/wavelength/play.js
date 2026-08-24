(function () {
  let myRole = null; // cached across update() calls, same reasoning as spyfall/imposter/headsUp
  let myTarget = null;
  let hasGuessed = false;

  function render(container) {
    container.innerHTML = `
      <h1>Wavelength</h1>
      <p class="subtitle" id="wl-spectrum-text"></p>
      <p class="status-banner" id="wl-role-banner" hidden></p>
      <div id="wl-body"></div>
    `;
  }

  function spectrumText(payload) {
    return payload.left && payload.right ? `${payload.left} ←→ ${payload.right}` : '';
  }

  function update(container, socket, payload, helpers) {
    if (payload.role) myRole = payload.role;
    if (payload.target) myTarget = payload.target;

    container.querySelector('#wl-spectrum-text').textContent = spectrumText(payload);
    const roleBanner = container.querySelector('#wl-role-banner');
    const bodyEl = container.querySelector('#wl-body');

    if (payload.phase === 'pending') {
      myRole = null;
      myTarget = null;
      hasGuessed = false;
      roleBanner.hidden = true;
      bodyEl.innerHTML = '<p class="subtitle">Waiting for the gamemaster to pick the next Clue Giver...</p>';
      return;
    }

    if (payload.phase === 'clueGiving') {
      hasGuessed = false;
      if (myRole === 'cluegiver') {
        roleBanner.hidden = false;
        roleBanner.className = 'status-banner waiting';
        roleBanner.textContent = `You're the Clue Giver. Secret target: ${myTarget}/10.`;
        bodyEl.innerHTML = `
          <input type="text" id="wl-clue-input" placeholder="One clue or phrase..." maxlength="60">
          <button type="button" id="wl-clue-btn">Submit Clue</button>
        `;
        const submit = () => {
          const input = bodyEl.querySelector('#wl-clue-input');
          const clue = input.value.trim();
          if (!clue) return;
          socket.emit('player:action', { clue });
        };
        bodyEl.querySelector('#wl-clue-btn').addEventListener('click', submit);
      } else {
        roleBanner.hidden = false;
        roleBanner.className = 'status-banner waiting';
        roleBanner.textContent = 'Waiting for the Clue Giver to think of a clue...';
        bodyEl.innerHTML = '';
      }
      return;
    }

    if (payload.phase === 'guessing') {
      if (payload.clue) {
        roleBanner.hidden = false;
        roleBanner.className = 'status-banner active';
        roleBanner.textContent = `Clue: "${payload.clue}"`;
      }

      if (myRole === 'cluegiver') {
        bodyEl.innerHTML = '<p class="subtitle">Waiting for everyone to guess...</p>';
        return;
      }
      if (hasGuessed) {
        bodyEl.innerHTML = '<p class="subtitle">Guess locked in — waiting for everyone else...</p>';
        return;
      }
      bodyEl.innerHTML = `
        <input type="range" id="wl-guess-range" min="1" max="10" value="5">
        <p class="subtitle" id="wl-guess-value">5</p>
        <button type="button" id="wl-guess-btn">Lock In Guess</button>
      `;
      const rangeEl = bodyEl.querySelector('#wl-guess-range');
      const valueEl = bodyEl.querySelector('#wl-guess-value');
      rangeEl.addEventListener('input', () => { valueEl.textContent = rangeEl.value; });
      bodyEl.querySelector('#wl-guess-btn').addEventListener('click', () => {
        socket.emit('player:action', { guess: Number(rangeEl.value) });
        hasGuessed = true;
        bodyEl.innerHTML = '<p class="subtitle">Guess locked in — waiting for everyone else...</p>';
      });
      return;
    }

    if (payload.phase === 'reveal') {
      roleBanner.hidden = false;
      roleBanner.className = 'status-banner active';
      roleBanner.textContent = `Target was ${payload.target}/10 — clue: "${payload.clue}"`;

      // Reads the live, connection-tied id rather than localStorage directly —
      // several browser tabs share one localStorage, so a tab reading it raw
      // right as another tab joins/rejoins could momentarily see the wrong
      // id. Same fix already applied to Spyfall/Imposter's self-id lookups.
      const mine = payload.results ? payload.results[helpers.getSelfId()] : null;
      let mineHtml = '';
      if (mine) {
        mineHtml = `<p class="subtitle">Your guess: ${mine.guess} — +${mine.points} points.</p>`;
      } else if (myRole === 'cluegiver') {
        mineHtml = `<p class="subtitle">As Clue Giver, you scored +${payload.clueGiverPoints} points.</p>`;
      }
      bodyEl.innerHTML = `${mineHtml}<p class="subtitle">Ask the gamemaster to pick the next Clue Giver when ready.</p>`;
    }
  }

  window.__vgGames = window.__vgGames || {};
  window.__vgGames.wavelength = { render, update };
})();
