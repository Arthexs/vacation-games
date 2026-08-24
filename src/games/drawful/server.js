// The most complex roundState of the six games: draw (once, everyone
// simultaneously) -> loop per submitted drawing (title -> vote ->
// drawingResult) -> gameOver. Per GAME_PLANS.md's own suggested middle
// ground: only the draw phase's timer is admin-triggered (the "settle in"
// pause matters there); the title and vote timers for each drawing
// auto-start, since requiring an admin tap before every single drawing's
// title/vote window would get repetitive fast.
const meta = require('./meta');
const prompts = require('./prompts');
const {
  broadcastLeaderboard,
  broadcastGameUpdate,
  sendPlayerUpdate,
  broadcastTvContent,
  clearTvContent,
} = require('../../broadcast');
const { startTimer } = require('../../timer');

const DRAW_SECONDS = 60; // not specced
const TITLE_SECONDS = 30;
const VOTE_SECONDS = 20;
const REVEAL_PAUSE_MS = 6000;
const CORRECT_GUESS_POINTS = 2; // a voter who picks the real prompt
const TRICK_POINTS = 1; // per vote a fake title fooled someone into picking
const ARTIST_STUMP_POINTS = 1; // per voter who did NOT pick the real prompt

function connectedPlayerIds(state) {
  return Object.values(state.players).filter((p) => p.connected).map((p) => p.id);
}

function shuffle(array) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function start(io, state) {
  const connectedIds = connectedPlayerIds(state);
  const assignments = {};
  connectedIds.forEach((id) => {
    assignments[id] = prompts[Math.floor(Math.random() * prompts.length)].id;
  });

  state.activeGame.roundState = {
    phase: 'draw', // draw -> title -> vote -> drawingResult -> (loop) -> gameOver
    assignments, // playerId -> promptId, fixed for the whole game session
    drawings: {}, // playerId -> dataURL
    artistOrder: [], // built once the draw phase closes: only players who actually submitted
    currentDrawingIndex: 0,
    currentArtistId: null,
    currentPrompt: null,
    fakeTitles: {}, // playerId -> title text, reset per drawing
    shuffledTitles: [], // [{id: 'real' | playerId, text}], reset per drawing
    votes: {}, // voterPlayerId -> the option id they voted for, reset per drawing
    timerHandle: null,
    revealTimeoutId: null,
  };

  connectedIds.forEach((id) => {
    const prompt = prompts.find((p) => p.id === assignments[id]);
    sendPlayerUpdate(io, state, id, { phase: 'draw', prompt: prompt.text });
  });
}

function stop(io, state) {
  const round = state.activeGame.roundState;
  if (round && round.timerHandle) round.timerHandle.clear();
  // Otherwise, ending the game mid-reveal-pause leaves this scheduled — it
  // would fire later and crash trying to read the now-null roundState.
  if (round && round.revealTimeoutId) clearTimeout(round.revealTimeoutId);
  clearTvContent(io, state);
  state.activeGame.roundState = null;
}

function closeDrawPhase(io, state) {
  const round = state.activeGame.roundState;
  if (round.timerHandle) {
    round.timerHandle.clear();
    round.timerHandle = null;
  }
  round.artistOrder = Object.keys(round.drawings);
  round.currentDrawingIndex = 0;

  if (round.artistOrder.length === 0) {
    round.phase = 'gameOver';
    broadcastGameUpdate(io, state, { phase: 'gameOver', noDrawings: true });
    return;
  }
  startDrawingReveal(io, state);
}

// Nothing secret at this point (fake-title authorship isn't revealed until
// the final drawingResult), so — unlike start()'s private prompt delivery —
// everything from here on is a plain room-wide broadcast. A client compares
// `artistId` to its own id locally to decide whether to show the
// title/vote controls or a "waiting" message, same pattern imposter's play.js
// already uses for turn order.
function startDrawingReveal(io, state) {
  const round = state.activeGame.roundState;
  const artistId = round.artistOrder[round.currentDrawingIndex];
  round.currentArtistId = artistId;
  round.currentPrompt = prompts.find((p) => p.id === round.assignments[artistId]).text;
  round.fakeTitles = {};
  round.shuffledTitles = [];
  round.votes = {};
  round.phase = 'title';

  const drawingDataUrl = round.drawings[artistId];
  const payload = { phase: 'title', drawingDataUrl, artistId };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);

  round.timerHandle = startTimer(io, state, {
    seconds: TITLE_SECONDS,
    label: 'Write a fake title',
    onComplete: () => closeTitlePhase(io, state),
  });
  broadcastGameUpdate(io, state, { ...payload, timer: round.timerHandle.timer });
}

function closeTitlePhase(io, state) {
  const round = state.activeGame.roundState;
  if (round.timerHandle) {
    round.timerHandle.clear();
    round.timerHandle = null;
  }

  const options = [{ id: 'real', text: round.currentPrompt }];
  Object.entries(round.fakeTitles).forEach(([playerId, title]) => {
    options.push({ id: playerId, text: title });
  });
  round.shuffledTitles = shuffle(options);
  round.phase = 'vote';

  const payload = {
    phase: 'vote',
    drawingDataUrl: round.drawings[round.currentArtistId],
    artistId: round.currentArtistId,
    options: round.shuffledTitles,
  };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);

  round.timerHandle = startTimer(io, state, {
    seconds: VOTE_SECONDS,
    label: 'Vote for the real prompt',
    onComplete: () => closeVotePhase(io, state),
  });
  broadcastGameUpdate(io, state, { ...payload, timer: round.timerHandle.timer });
}

// Not first-past-the-post — every fake title scores by its own vote count
// independently — so a tie in votes needs no special-casing at all.
function closeVotePhase(io, state) {
  const round = state.activeGame.roundState;
  if (round.timerHandle) {
    round.timerHandle.clear();
    round.timerHandle = null;
  }

  const voteCounts = {};
  round.shuffledTitles.forEach((o) => { voteCounts[o.id] = 0; });
  let correctCount = 0;
  Object.values(round.votes).forEach((votedForId) => {
    voteCounts[votedForId] = (voteCounts[votedForId] || 0) + 1;
    if (votedForId === 'real') correctCount += 1;
  });

  Object.entries(round.votes).forEach(([voterId, votedForId]) => {
    if (votedForId === 'real' && state.players[voterId]) {
      state.players[voterId].score += CORRECT_GUESS_POINTS;
    }
  });
  Object.keys(round.fakeTitles).forEach((authorId) => {
    const tricked = voteCounts[authorId] || 0;
    if (tricked > 0 && state.players[authorId]) state.players[authorId].score += tricked * TRICK_POINTS;
  });
  const totalVoters = Object.keys(round.votes).length;
  const wrongCount = totalVoters - correctCount;
  const artist = state.players[round.currentArtistId];
  if (wrongCount > 0 && artist) artist.score += wrongCount * ARTIST_STUMP_POINTS;

  round.phase = 'drawingResult';
  const payload = {
    phase: 'drawingResult',
    drawingDataUrl: round.drawings[round.currentArtistId],
    artistId: round.currentArtistId,
    artistName: artist ? artist.name : null,
    realTitle: round.currentPrompt,
    options: round.shuffledTitles.map((o) => ({
      id: o.id,
      text: o.text,
      votes: voteCounts[o.id] || 0,
      authorName: o.id === 'real' ? null : (state.players[o.id] ? state.players[o.id].name : null),
    })),
  };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
  broadcastLeaderboard(io, state);

  round.revealTimeoutId = setTimeout(() => advanceDrawing(io, state), REVEAL_PAUSE_MS);
}

function advanceDrawing(io, state) {
  const round = state.activeGame.roundState;
  round.currentDrawingIndex += 1;
  if (round.currentDrawingIndex >= round.artistOrder.length) {
    clearTvContent(io, state);
    round.phase = 'gameOver';
    broadcastGameUpdate(io, state, { phase: 'gameOver' });
    return;
  }
  startDrawingReveal(io, state);
}

function handleAdminAction(io, state, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round || payload.type !== 'startTimer') return;
  if (round.phase !== 'draw' || round.timerHandle) return;

  round.timerHandle = startTimer(io, state, {
    seconds: DRAW_SECONDS,
    label: 'Drawing time',
    onComplete: () => closeDrawPhase(io, state),
  });
  // No prompt content here — safe to broadcast; each player already has
  // their own prompt cached client-side from the private send in start().
  broadcastGameUpdate(io, state, { phase: 'draw', timer: round.timerHandle.timer });
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round) return;

  if (typeof payload.drawingDataUrl === 'string') {
    if (round.phase !== 'draw' || round.drawings[playerId]) return;
    round.drawings[playerId] = payload.drawingDataUrl;
    const connectedIds = connectedPlayerIds(state);
    if (connectedIds.every((id) => round.drawings[id])) closeDrawPhase(io, state);
    return;
  }

  if (typeof payload.title === 'string') {
    if (round.phase !== 'title' || playerId === round.currentArtistId) return;
    if (round.fakeTitles[playerId]) return;
    const title = payload.title.trim();
    if (!title) return;
    round.fakeTitles[playerId] = title;
    const others = connectedPlayerIds(state).filter((id) => id !== round.currentArtistId);
    if (others.every((id) => round.fakeTitles[id])) closeTitlePhase(io, state);
    return;
  }

  if (payload.vote) {
    if (round.phase !== 'vote' || playerId === round.currentArtistId) return;
    if (round.votes[playerId]) return;
    const validIds = round.shuffledTitles.map((o) => o.id);
    if (!validIds.includes(payload.vote)) return;
    round.votes[playerId] = payload.vote;
    const others = connectedPlayerIds(state).filter((id) => id !== round.currentArtistId);
    if (others.every((id) => round.votes[id])) closeVotePhase(io, state);
  }
}

module.exports = { meta, start, stop, handleAction, handleAdminAction };
