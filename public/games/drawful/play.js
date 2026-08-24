(function () {
  const selfId = localStorage.getItem('vg_playerId');
  const CANVAS_WIDTH = 500;
  const CANVAS_HEIGHT = 350;

  let myPrompt = null;
  let canvasBuilt = false; // guards against re-rendering (and wiping) the canvas on a second 'draw' payload
  let currentDrawingKey = null; // tracks which drawing's title/vote phase we're on, to reset flags per drawing
  let hasSubmittedTitle = false;
  let hasVoted = false;
  let timerInterval = null;

  function render(container) {
    container.innerHTML = `
      <h1>Doodle Deception</h1>
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

  function buildDrawUi(container, socket) {
    const bodyEl = container.querySelector('#df-body');
    bodyEl.innerHTML = `
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
      bodyEl.innerHTML = '<p class="status-banner waiting">Drawing submitted — waiting for everyone else...</p>';
    });
  }

  function renderTitlePhase(container, socket, payload) {
    const bodyEl = container.querySelector('#df-body');
    const isArtist = payload.artistId === selfId;

    if (isArtist) {
      bodyEl.innerHTML = `
        <img class="df-drawing" src="${payload.drawingDataUrl}" alt="Your drawing">
        <p class="status-banner waiting">Everyone's writing fake titles for your drawing!</p>
      `;
      return;
    }
    if (hasSubmittedTitle) {
      bodyEl.innerHTML = `<img class="df-drawing" src="${payload.drawingDataUrl}" alt="A drawing"><p class="status-banner waiting">Title submitted — waiting for everyone else...</p>`;
      return;
    }
    bodyEl.innerHTML = `
      <img class="df-drawing" src="${payload.drawingDataUrl}" alt="A drawing">
      <input type="text" id="df-title-input" placeholder="Write a believable fake title..." maxlength="60">
      <button type="button" id="df-title-btn">Submit Title</button>
    `;
    const submit = () => {
      const input = bodyEl.querySelector('#df-title-input');
      const title = input.value.trim();
      if (!title) return;
      socket.emit('player:action', { title });
      hasSubmittedTitle = true;
      renderTitlePhase(container, socket, payload);
    };
    bodyEl.querySelector('#df-title-btn').addEventListener('click', submit);
  }

  function renderVotePhase(container, socket, payload) {
    const bodyEl = container.querySelector('#df-body');
    const isArtist = payload.artistId === selfId;

    if (isArtist) {
      bodyEl.innerHTML = `
        <img class="df-drawing" src="${payload.drawingDataUrl}" alt="Your drawing">
        <p class="status-banner waiting">Everyone's voting on your drawing's title!</p>
      `;
      return;
    }
    if (hasVoted) {
      bodyEl.innerHTML = `<img class="df-drawing" src="${payload.drawingDataUrl}" alt="A drawing"><p class="status-banner waiting">Vote submitted — waiting for everyone else...</p>`;
      return;
    }
    const optionsHtml = payload.options
      .map((o, i) => `<button type="button" class="option-btn" data-index="${i}">${o.text}</button>`)
      .join('');
    bodyEl.innerHTML = `
      <img class="df-drawing" src="${payload.drawingDataUrl}" alt="A drawing">
      <p class="subtitle">Which title is the real one?</p>
      <div id="df-vote-options">${optionsHtml}</div>
    `;
    bodyEl.querySelectorAll('.option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const option = payload.options[Number(btn.dataset.index)];
        socket.emit('player:action', { vote: option.id });
        hasVoted = true;
        renderVotePhase(container, socket, payload);
      });
    });
  }

  function renderDrawingResult(container, payload) {
    const bodyEl = container.querySelector('#df-body');
    const rows = payload.options
      .map((o) => {
        const label = o.id === 'real' ? `<strong>${o.text}</strong> (the real prompt!)` : `${o.text} — ${o.authorName || '?'}`;
        return `<li>${label} — ${o.votes} vote${o.votes === 1 ? '' : 's'}</li>`;
      })
      .join('');
    bodyEl.innerHTML = `
      <img class="df-drawing" src="${payload.drawingDataUrl}" alt="A drawing">
      <p class="status-banner active">${payload.artistName}'s drawing was: "${payload.realTitle}"</p>
      <ul class="clue-log">${rows}</ul>
    `;
  }

  function update(container, socket, payload) {
    if (payload.prompt) myPrompt = payload.prompt;
    const statusText = container.querySelector('#df-status-text');
    const bodyEl = container.querySelector('#df-body');

    if (payload.phase === 'draw') {
      statusText.textContent = myPrompt ? `Draw: "${myPrompt}"` : '';
      if (payload.timer) startTimerDisplay(container, payload.timer);
      if (!canvasBuilt) {
        buildDrawUi(container, socket);
        canvasBuilt = true;
      }
      return;
    }

    canvasBuilt = false; // left the draw phase — reset in case it's ever entered again

    if (payload.phase === 'title') {
      if (payload.artistId !== currentDrawingKey) {
        currentDrawingKey = payload.artistId;
        hasSubmittedTitle = false;
        hasVoted = false;
      }
      statusText.textContent = 'Guess titles for this drawing';
      if (payload.timer) startTimerDisplay(container, payload.timer);
      renderTitlePhase(container, socket, payload);
      return;
    }

    if (payload.phase === 'vote') {
      statusText.textContent = 'Vote for the real prompt';
      if (payload.timer) startTimerDisplay(container, payload.timer);
      renderVotePhase(container, socket, payload);
      return;
    }

    if (payload.phase === 'drawingResult') {
      stopTimerDisplay(container);
      statusText.textContent = 'Results';
      renderDrawingResult(container, payload);
      return;
    }

    if (payload.phase === 'gameOver') {
      stopTimerDisplay(container);
      statusText.textContent = 'All done!';
      bodyEl.innerHTML = '<p class="subtitle">Every drawing has been shown. Ask the gamemaster to end the game.</p>';
    }
  }

  window.__vgGames = window.__vgGames || {};
  window.__vgGames.drawful = { render, update };
})();
