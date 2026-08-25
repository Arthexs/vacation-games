(function () {
  const selfId = localStorage.getItem('vg_playerId');
  const CANVAS_WIDTH = 500;
  const CANVAS_HEIGHT = 350;

  let myAssignment = null; // last private payload: {phase, currentRound, totalRounds, isFirstEntry, prevEntry}
  let uiRoundKey = null; // `${phase}-${currentRound}` the body is currently built for — guards against wiping in-progress input on a timer-only re-update
  let hasSubmitted = false;
  let chainVoteBuilt = false; // guards against rebuilding (and losing hasVotedChain's rendered state) on the timer-only re-update
  let hasVotedChain = false;
  let timerInterval = null;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(container) {
    container.innerHTML = `
      <h1>Telephone Doodles</h1>
      <p class="subtitle" id="df-status-text"></p>
      <p class="timer-inline" id="df-timer" hidden></p>
      <div id="df-body"></div>
    `;
  }

  function stopTimerDisplay(container) {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = null;
    container.querySelector('#df-timer').hidden = true;
  }

  function startTimerDisplay(container, { startedAt, durationMs, label }) {
    const timerEl = container.querySelector('#df-timer');
    timerEl.hidden = false;
    function tick() {
      const remainingMs = Math.max(0, startedAt + durationMs - Date.now());
      const totalSeconds = Math.ceil(remainingMs / 1000);
      timerEl.textContent = `${label || 'Time'}: ${totalSeconds}s`;
      if (remainingMs <= 0 && timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
    if (timerInterval) clearInterval(timerInterval);
    tick();
    timerInterval = setInterval(tick, 250);
  }

  function buildDrawUi(bodyEl, socket, assignment) {
    const prev = assignment.prevEntry;
    bodyEl.innerHTML = `
      <p class="subtitle">Draw: &ldquo;${escapeHtml(prev.text)}&rdquo;</p>
      <canvas id="df-canvas" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" class="df-canvas"></canvas>
      <div class="hl-buttons">
        <button type="button" id="df-clear-btn" class="secondary">Clear</button>
        <button type="button" id="df-submit-btn">Submit Drawing</button>
      </div>
    `;

    const canvas = bodyEl.querySelector('#df-canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let drawing = false;
    function posFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    }
    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      const pos = posFromEvent(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const pos = posFromEvent(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((evt) => {
      canvas.addEventListener(evt, () => { drawing = false; });
    });

    bodyEl.querySelector('#df-clear-btn').addEventListener('click', () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });
    bodyEl.querySelector('#df-submit-btn').addEventListener('click', () => {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      socket.emit('player:action', { drawingDataUrl: dataUrl });
      hasSubmitted = true;
      bodyEl.innerHTML = '<p class="status-banner waiting">Drawing submitted — waiting for everyone else...</p>';
    });
  }

  function buildWriteUi(bodyEl, socket, assignment) {
    const prev = assignment.prevEntry;
    const promptHtml = assignment.isFirstEntry
      ? '<p class="subtitle">Write a weird scenario for someone else to draw.</p>'
      : `<img class="df-drawing" src="${prev.drawingDataUrl}" alt="A drawing"><p class="subtitle">What do you think this drawing shows?</p>`;
    bodyEl.innerHTML = `
      ${promptHtml}
      <input type="text" id="df-text-input" placeholder="${assignment.isFirstEntry ? 'e.g. A confused giraffe doing yoga' : 'Your best guess...'}" maxlength="80">
      <button type="button" id="df-text-btn">Submit</button>
    `;
    const submit = () => {
      const input = bodyEl.querySelector('#df-text-input');
      const text = input.value.trim();
      if (!text) return;
      socket.emit('player:action', { text });
      hasSubmitted = true;
      bodyEl.innerHTML = '<p class="status-banner waiting">Submitted — waiting for everyone else...</p>';
    };
    bodyEl.querySelector('#df-text-btn').addEventListener('click', submit);
    bodyEl.querySelector('#df-text-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  }

  function renderEntry(entry) {
    if (entry.type === 'write') {
      return `<li>&ldquo;${escapeHtml(entry.text)}&rdquo; <span class="subtitle">— ${escapeHtml(entry.authorName)}</span></li>`;
    }
    return `<li><img class="df-drawing" src="${entry.drawingDataUrl}" alt="A drawing"><span class="subtitle">— ${escapeHtml(entry.authorName)}</span></li>`;
  }

  function renderReveal(bodyEl, payload) {
    const rows = payload.entries.map(renderEntry).join('');
    bodyEl.innerHTML = `<ul class="clue-log">${rows}</ul>`;
  }

  function renderChainVote(bodyEl, socket, options) {
    const choices = options.filter((o) => o.id !== selfId);
    const buttonsHtml = choices
      .map((o) => `<button type="button" class="option-btn" data-id="${o.id}">${escapeHtml(o.ownerName)}'s chain</button>`)
      .join('');
    bodyEl.innerHTML = `
      <p class="subtitle">Which chain was your favorite? (not your own)</p>
      <div id="df-vote-options">${buttonsHtml}</div>
    `;
    bodyEl.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        socket.emit('player:action', { voteFor: btn.dataset.id });
        hasVotedChain = true;
        bodyEl.innerHTML = '<p class="status-banner waiting">Vote submitted — waiting for everyone else...</p>';
      });
    });
  }

  function renderVoteResults(voteResults) {
    if (!voteResults || !voteResults.length) return '';
    const rows = voteResults
      .map((r) => `<li>${escapeHtml(r.ownerName)}'s chain — ${r.votes} vote${r.votes === 1 ? '' : 's'}</li>`)
      .join('');
    return `<p class="subtitle">Favorite chain results:</p><ul class="clue-log">${rows}</ul>`;
  }

  function update(container, socket, payload) {
    const statusText = container.querySelector('#df-status-text');
    const bodyEl = container.querySelector('#df-body');

    if (payload.phase === 'pending') {
      stopTimerDisplay(container);
      myAssignment = null;
      uiRoundKey = null;
      chainVoteBuilt = false;
      hasVotedChain = false;
      statusText.textContent = `Waiting for the gamemaster to start — ${payload.totalRounds || '?'} rounds`;
      bodyEl.innerHTML = '<p class="status-banner waiting">Get ready to write something weird!</p>';
      return;
    }

    if (payload.phase === 'write' || payload.phase === 'draw') {
      if ('prevEntry' in payload) {
        myAssignment = payload;
        hasSubmitted = false;
        uiRoundKey = null; // force a rebuild for the new round
      }
      if (payload.timer) startTimerDisplay(container, payload.timer);

      statusText.textContent = payload.phase === 'draw'
        ? 'Draw what was written'
        : (myAssignment && myAssignment.isFirstEntry ? 'Write something weird' : 'What do you think this is?');

      if (hasSubmitted) {
        bodyEl.innerHTML = '<p class="status-banner waiting">Submitted — waiting for everyone else...</p>';
        return;
      }

      const roundKey = `${payload.phase}-${payload.currentRound}`;
      if (uiRoundKey !== roundKey && myAssignment) {
        uiRoundKey = roundKey;
        if (payload.phase === 'write') {
          buildWriteUi(bodyEl, socket, myAssignment);
        } else {
          buildDrawUi(bodyEl, socket, myAssignment);
        }
      }
      return;
    }

    if (payload.phase === 'reveal') {
      stopTimerDisplay(container);
      statusText.textContent = `Chain ${payload.chainNumber} of ${payload.totalChains} — started by ${payload.ownerName}`;
      renderReveal(bodyEl, payload);
      return;
    }

    if (payload.phase === 'vote') {
      if (payload.timer) startTimerDisplay(container, payload.timer);
      statusText.textContent = 'Vote for your favorite chain';
      if (hasVotedChain) {
        bodyEl.innerHTML = '<p class="status-banner waiting">Vote submitted — waiting for everyone else...</p>';
        return;
      }
      if (!chainVoteBuilt) {
        chainVoteBuilt = true;
        renderChainVote(bodyEl, socket, payload.options);
      }
      return;
    }

    if (payload.phase === 'gameOver') {
      stopTimerDisplay(container);
      statusText.textContent = payload.noPlayers ? 'No players connected.' : 'Every chain has been revealed!';
      bodyEl.innerHTML = `${renderVoteResults(payload.voteResults)}<p class="subtitle">Ask the gamemaster to end the game.</p>`;
    }
  }

  window.__vgGames = window.__vgGames || {};
  window.__vgGames.drawful = { render, update };
})();
