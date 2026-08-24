(function () {
  // Per-player secrets (role/location) arrive via sendPlayerUpdate and don't
  // repeat on every later broadcast (e.g. the room-wide "timer started"
  // update) — remembered across update() calls so the UI doesn't lose them.
  let myRole = null;
  let myLocation = null;
  let myLocations = null;
  let spyGuessUsed = false;
  let timerInterval = null;
  // The id of the last vote call this player already answered (Vote or
  // Pass), so a re-render of the same still-open call shows a "waiting on
  // everyone else" message instead of the prompt again — but a genuinely new
  // call (different id, e.g. from a later round) still gets the fresh prompt.
  let respondedVoteCallId = null;

  function render(container) {
    container.innerHTML = `
      <h1>Spyfall</h1>
      <p class="status-banner" id="sf-role-banner" hidden></p>
      <p class="subtitle" id="sf-phase-text"></p>
      <p class="timer-inline" id="sf-timer" hidden></p>
      <div id="sf-body"></div>
      <div id="sf-vote-call-area"></div>
      <div class="modal-overlay" id="sf-vote-call-modal" hidden>
        <div class="modal-card">
          <p class="subtitle" id="sf-vote-call-text"></p>
          <div class="modal-actions" id="sf-vote-call-actions">
            <button type="button" id="sf-vote-call-vote-btn">Vote</button>
            <button type="button" id="sf-vote-call-pass-btn" class="secondary">Pass</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderVoteCallButton(container, socket, disabled) {
    const area = container.querySelector('#sf-vote-call-area');
    area.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Call for a Vote';
    btn.disabled = disabled;
    btn.addEventListener('click', () => {
      socket.emit('player:action', { initiateVote: true });
    });
    area.appendChild(btn);
  }

  function hideVoteCallPopup(container) {
    container.querySelector('#sf-vote-call-modal').hidden = true;
  }

  function showVoteCallPopup(container, socket, voteCall) {
    const modal = container.querySelector('#sf-vote-call-modal');
    const textEl = container.querySelector('#sf-vote-call-text');
    const actionsEl = container.querySelector('#sf-vote-call-actions');
    modal.hidden = false;

    if (respondedVoteCallId === voteCall.id) {
      textEl.textContent = `${voteCall.initiatorName} called for a vote — waiting for everyone else...`;
      actionsEl.hidden = true;
      return;
    }

    textEl.textContent = `${voteCall.initiatorName} wants to call a vote. Vote now?`;
    actionsEl.hidden = false;
    const respond = (response) => {
      respondedVoteCallId = voteCall.id;
      socket.emit('player:action', { voteCallResponse: response });
      showVoteCallPopup(container, socket, voteCall);
    };
    container.querySelector('#sf-vote-call-vote-btn').onclick = () => respond('vote');
    container.querySelector('#sf-vote-call-pass-btn').onclick = () => respond('pass');
  }

  function stopTimerDisplay(container) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    container.querySelector('#sf-timer').hidden = true;
  }

  function startTimerDisplay(container, { startedAt, durationMs, label }) {
    const timerEl = container.querySelector('#sf-timer');
    timerEl.hidden = false;
    function tick() {
      const remainingMs = Math.max(0, startedAt + durationMs - Date.now());
      const totalSeconds = Math.ceil(remainingMs / 1000);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      timerEl.textContent = `${label || 'Time'}: ${mins}:${String(secs).padStart(2, '0')}`;
      if (remainingMs <= 0 && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
    if (timerInterval) clearInterval(timerInterval);
    tick();
    timerInterval = setInterval(tick, 250);
  }

  function renderDiscussion(container) {
    const bodyEl = container.querySelector('#sf-body');
    const roleBanner = container.querySelector('#sf-role-banner');

    if (myRole === 'spy') {
      roleBanner.hidden = false;
      roleBanner.className = 'status-banner waiting';

      if (spyGuessUsed) {
        roleBanner.textContent = 'You are the SPY! Blend in and hope you\'re not caught.';
        bodyEl.innerHTML = '<p class="subtitle">You\'ve used your one guess and it was wrong — no more guessing this round.</p>';
        return;
      }

      roleBanner.textContent = "You are the SPY! Blend in, and guess the location whenever you're ready — you only get one try.";

      const options = (myLocations || [])
        .map((loc) => `<option value="${loc.id}">${loc.name}</option>`)
        .join('');
      bodyEl.innerHTML = `
        <select id="sf-guess-select">${options}</select>
        <button type="button" id="sf-guess-btn">Guess the Location (one try)</button>
      `;
      bodyEl.querySelector('#sf-guess-btn').addEventListener('click', () => {
        const select = bodyEl.querySelector('#sf-guess-select');
        socket.emit('player:action', { guessLocation: select.value });
      });
    } else if (myRole === 'player') {
      roleBanner.hidden = false;
      roleBanner.className = 'status-banner active';
      roleBanner.textContent = `Your location: ${myLocation}`;
      bodyEl.innerHTML = '<p class="subtitle">Question each other to find the Spy — they don\'t know the location.</p>';
    } else {
      // Reconnected mid-discussion — the per-player role send isn't replayed
      // on reconnect (see server.js), so this is the best we can show.
      roleBanner.hidden = true;
      bodyEl.innerHTML = '<p class="subtitle">Discussion in progress — ask the gamemaster for a recap if you missed your role.</p>';
    }
  }

  function renderVoting(container, socket, helpers) {
    const bodyEl = container.querySelector('#sf-body');
    const selfId = helpers.getSelfId();
    const others = helpers.getPlayers().filter((p) => p.connected && p.id !== selfId);

    const ul = document.createElement('ul');
    ul.className = 'player-picker';
    others.forEach((p) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `Vote ${p.name}`;
      btn.addEventListener('click', () => {
        socket.emit('player:action', { vote: p.id });
        bodyEl.innerHTML = '<p class="status-banner waiting">Vote submitted — waiting for everyone else...</p>';
      });
      li.appendChild(btn);
      ul.appendChild(li);
    });
    bodyEl.innerHTML = '<p class="subtitle">Who do you think is the Spy?</p>';
    bodyEl.appendChild(ul);
  }

  function renderReveal(container, payload) {
    const bodyEl = container.querySelector('#sf-body');
    container.querySelector('#sf-role-banner').hidden = true;

    const outcomeText = {
      caught: `The group caught the Spy! ${payload.spyName} was the Spy.`,
      escaped: `The Spy got away! ${payload.spyName} was the Spy.`,
      guessedLocation: `${payload.spyName} (the Spy) correctly guessed the location!`,
    }[payload.outcome] || 'Round over.';

    bodyEl.innerHTML = `
      <p class="status-banner active">${outcomeText}</p>
      <p class="subtitle">The location was: <strong>${payload.location}</strong></p>
      <p class="subtitle">Ask the gamemaster to start a new round when you're ready.</p>
    `;
  }

  function update(container, socket, payload, helpers) {
    if (payload.role) myRole = payload.role;
    if (payload.location) myLocation = payload.location;
    if (payload.locations) myLocations = payload.locations;
    if (payload.wrongGuess) spyGuessUsed = true;

    const phaseText = container.querySelector('#sf-phase-text');
    const bodyEl = container.querySelector('#sf-body');

    if (payload.phase !== 'discussion') {
      hideVoteCallPopup(container);
      container.querySelector('#sf-vote-call-area').innerHTML = '';
    }

    if (payload.phase === 'pending') {
      stopTimerDisplay(container);
      container.querySelector('#sf-role-banner').hidden = true;
      phaseText.textContent = 'Waiting for the gamemaster to choose a Spy...';
      bodyEl.innerHTML = '';
      respondedVoteCallId = null;
      spyGuessUsed = false;
      return;
    }

    if (payload.phase === 'discussion') {
      phaseText.textContent = 'Discussion phase — talk it out!';
      if (payload.timer) startTimerDisplay(container, payload.timer);
      renderDiscussion(container);
      if (payload.wrongGuess) {
        const note = document.createElement('p');
        note.className = 'status-banner waiting';
        note.textContent = 'Not the right location — that was your one guess.';
        bodyEl.prepend(note);
      }

      renderVoteCallButton(container, socket, !!payload.voteCall);
      if (payload.voteCall) {
        showVoteCallPopup(container, socket, payload.voteCall);
      } else {
        hideVoteCallPopup(container);
        if (payload.voteCallFailed) {
          const note = document.createElement('p');
          note.className = 'status-banner waiting';
          note.textContent = 'Not enough support to start a vote — discussion continues.';
          bodyEl.prepend(note);
        }
      }
      return;
    }

    if (payload.phase === 'voting') {
      stopTimerDisplay(container);
      container.querySelector('#sf-role-banner').hidden = true;
      phaseText.textContent = 'Voting — who was the Spy?';
      renderVoting(container, socket, helpers);
      return;
    }

    if (payload.phase === 'reveal') {
      stopTimerDisplay(container);
      phaseText.textContent = 'Round over';
      renderReveal(container, payload);
      myRole = null;
      myLocation = null;
      myLocations = null;
      spyGuessUsed = false;
      respondedVoteCallId = null;
    }
  }

  window.__vgGames = window.__vgGames || {};
  window.__vgGames.spyfall = { render, update };
})();
