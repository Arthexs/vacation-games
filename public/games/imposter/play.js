(function () {
  // Per-player secret (role/word), like Spyfall, doesn't repeat on every
  // later broadcast — cached across update() calls.
  let myRole = null;
  let myWord = null;

  function render(container) {
    container.innerHTML = `
      <h1>Fake It Til You Make It</h1>
      <p class="status-banner" id="im-role-banner" hidden></p>
      <p class="subtitle" id="im-phase-text"></p>
      <div id="im-body"></div>
    `;
  }

  function renderClueLog(clueLog) {
    if (!clueLog.length) return '<p class="subtitle">No clues yet.</p>';
    return `<ul class="clue-log">${clueLog
      .map((entry) => `<li><strong>${entry.name}:</strong> ${entry.clue}</li>`)
      .join('')}</ul>`;
  }

  function renderClues(container, socket, payload, helpers) {
    const bodyEl = container.querySelector('#im-body');
    const isMyTurn = payload.currentTurnId === helpers.getSelfId();

    let controlsHtml = payload.currentTurnName
      ? `<p class="status-banner waiting">Waiting for ${payload.currentTurnName}'s turn...</p>`
      : '<p class="status-banner waiting">Waiting for your turn...</p>';
    if (isMyTurn) {
      controlsHtml = `
        <input type="text" id="im-clue-input" placeholder="One-word clue..." maxlength="40">
        <button type="button" id="im-clue-btn">Submit Clue</button>
      `;
    }

    bodyEl.innerHTML = `${renderClueLog(payload.clueLog)}${controlsHtml}`;

    if (isMyTurn) {
      const submit = () => {
        const input = bodyEl.querySelector('#im-clue-input');
        const clue = input.value.trim();
        if (!clue) return;
        socket.emit('player:action', { clue });
      };
      bodyEl.querySelector('#im-clue-btn').addEventListener('click', submit);
      bodyEl.querySelector('#im-clue-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
      });
    }
  }

  function renderVoting(container, socket, payload, helpers) {
    const bodyEl = container.querySelector('#im-body');
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

    bodyEl.innerHTML = `${renderClueLog(payload.clueLog)}<p class="subtitle">Who do you think is the Imposter?</p>`;
    bodyEl.appendChild(ul);
  }

  function renderReveal(container, payload) {
    const bodyEl = container.querySelector('#im-body');
    container.querySelector('#im-role-banner').hidden = true;

    const outcomeText = payload.outcome === 'caught'
      ? `The group caught the Imposter! ${payload.imposterName} was faking it.`
      : `The Imposter got away! ${payload.imposterName} was faking it.`;

    bodyEl.innerHTML = `
      <p class="status-banner active">${outcomeText}</p>
      <p class="subtitle">The real word was <strong>${payload.word}</strong> — the Imposter had <strong>${payload.decoyWord}</strong>.</p>
      <p class="subtitle">Ask the gamemaster to start a new round when you're ready.</p>
    `;
  }

  function update(container, socket, payload, helpers) {
    if (payload.role) myRole = payload.role;
    if (payload.word) myWord = payload.word;

    const phaseText = container.querySelector('#im-phase-text');
    const roleBanner = container.querySelector('#im-role-banner');
    const bodyEl = container.querySelector('#im-body');

    if (payload.phase === 'pending') {
      roleBanner.hidden = true;
      phaseText.textContent = 'Waiting for the gamemaster to choose an Imposter...';
      bodyEl.innerHTML = '';
      return;
    }

    if (payload.phase === 'clues') {
      phaseText.textContent = 'Take turns giving a one-word clue.';
      if (myRole === 'imposter') {
        roleBanner.hidden = false;
        roleBanner.className = 'status-banner waiting';
        roleBanner.textContent = `You are the IMPOSTER. Your word: ${myWord} (it might not match everyone else's!)`;
      } else if (myRole === 'player') {
        roleBanner.hidden = false;
        roleBanner.className = 'status-banner active';
        roleBanner.textContent = `Your word: ${myWord}`;
      } else {
        roleBanner.hidden = true;
      }
      renderClues(container, socket, payload, helpers);
      if (payload.notYourTurn) {
        const note = document.createElement('p');
        note.className = 'status-banner waiting';
        note.textContent = "Not your turn yet!";
        bodyEl.prepend(note);
      }
      return;
    }

    if (payload.phase === 'voting') {
      roleBanner.hidden = true;
      phaseText.textContent = 'Voting — who was the Imposter?';
      renderVoting(container, socket, payload, helpers);
      return;
    }

    if (payload.phase === 'reveal') {
      phaseText.textContent = 'Round over';
      renderReveal(container, payload);
      myRole = null;
      myWord = null;
    }
  }

  window.__vgGames = window.__vgGames || {};
  window.__vgGames.imposter = { render, update };
})();
