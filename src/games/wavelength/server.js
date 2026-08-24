// Loops for the whole game session, like headsUp: pending -> admin picks the
// Clue Giver -> clueGiving -> guessing -> reveal -> pending -> repeat until
// the admin ends the game. No admin-triggered guess timer — the round
// already resolves on its own once every connected guesser has locked in a
// guess (see handleAction below), so a timer would only ever have added
// pressure, not gated anything.
const meta = require('./meta');
const spectrums = require('./spectrums');
const {
  broadcastLeaderboard,
  broadcastGameUpdate,
  sendPlayerUpdate,
  broadcastTvContent,
  clearTvContent,
} = require('../../broadcast');

const MIN_PLAYERS = 2; // specced explicitly: 1 Clue Giver + 1 Guesser minimum
const REVEAL_PAUSE_MS = 6000; // longer than other games' — there's a plotted scale to actually read

function connectedPlayerIds(state) {
  return Object.values(state.players).filter((p) => p.connected).map((p) => p.id);
}

function guesserIds(state) {
  const round = state.activeGame.roundState;
  return connectedPlayerIds(state).filter((id) => id !== round.clueGiverId);
}

function start(io, state) {
  const spectrum = spectrums[Math.floor(Math.random() * spectrums.length)];
  state.activeGame.roundState = {
    phase: 'pending', // pending -> clueGiving -> guessing -> reveal -> pending -> ...
    spectrum,
    clueGiverId: null,
    target: null, // 1-10, secret to everyone but the Clue Giver until reveal
    clue: null,
    guesses: {}, // playerId -> 1-10
    revealTimeoutId: null,
  };
  broadcastGameUpdate(io, state, { phase: 'pending' });
}

function stop(io, state) {
  const round = state.activeGame.roundState;
  // Otherwise, ending the game mid-reveal-pause leaves this scheduled — it
  // would fire later and crash trying to read the now-null roundState.
  if (round && round.revealTimeoutId) clearTimeout(round.revealTimeoutId);
  clearTvContent(io, state);
  state.activeGame.roundState = null;
}

function handleAdminAction(io, state, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round || payload.type !== 'assignRole') return;
  if (round.phase !== 'pending') return;
  if (connectedPlayerIds(state).length < MIN_PLAYERS) return;
  const clueGiver = state.players[payload.playerId];
  if (!clueGiver || !clueGiver.connected) return;

  round.clueGiverId = clueGiver.id;
  round.target = 1 + Math.floor(Math.random() * 10);
  round.phase = 'clueGiving';
  const { left, right } = round.spectrum;

  connectedPlayerIds(state).forEach((id) => {
    if (id === clueGiver.id) {
      sendPlayerUpdate(io, state, id, { phase: 'clueGiving', role: 'cluegiver', left, right, target: round.target });
    } else {
      sendPlayerUpdate(io, state, id, { phase: 'clueGiving', role: 'guesser', left, right });
    }
  });
  // Room-wide (no target — that went out above, cluegiver-only), so the
  // admin panel actually learns the round moved past 'pending' and swaps
  // its stale Clue Giver picker for the "waiting for a clue" message.
  // Without this, admin.js never receives another game:update until the
  // Clue Giver submits a clue (if ever), left showing picker buttons that
  // no longer do anything — same bug Spyfall/Imposter/Heads Up! had.
  broadcastGameUpdate(io, state, { phase: 'clueGiving', left, right });
  // Labels only — safe for everyone including the Clue Giver, this is the
  // shared axis the room is working with before a clue even exists.
  broadcastTvContent(io, state, { phase: 'clueGiving', left, right });
}

function resolveRound(io, state) {
  const round = state.activeGame.roundState;

  const results = {};
  const points = [];
  Object.entries(round.guesses).forEach(([playerId, guess]) => {
    const guesser = state.players[playerId];
    if (!guesser) return;
    const score = Math.max(0, 3 - Math.abs(guess - round.target));
    guesser.score += score;
    results[playerId] = { name: guesser.name, guess, points: score };
    points.push(score);
  });

  const clueGiver = state.players[round.clueGiverId];
  const clueGiverPoints = points.length > 0 ? Math.round(points.reduce((a, b) => a + b, 0) / points.length) : 0;
  if (clueGiver) clueGiver.score += clueGiverPoints;

  round.phase = 'reveal';
  const { left, right } = round.spectrum;
  const revealPayload = {
    phase: 'reveal',
    left,
    right,
    clue: round.clue,
    target: round.target,
    results,
    clueGiverName: clueGiver ? clueGiver.name : null,
    clueGiverPoints,
  };
  broadcastGameUpdate(io, state, revealPayload);
  broadcastTvContent(io, state, revealPayload);
  broadcastLeaderboard(io, state);

  round.revealTimeoutId = setTimeout(() => {
    clearTvContent(io, state);
    startNextRound(io, state);
  }, REVEAL_PAUSE_MS);
}

function startNextRound(io, state) {
  const spectrum = spectrums[Math.floor(Math.random() * spectrums.length)];
  state.activeGame.roundState = {
    phase: 'pending',
    spectrum,
    clueGiverId: null,
    target: null,
    clue: null,
    guesses: {},
    revealTimeoutId: null,
  };
  broadcastGameUpdate(io, state, { phase: 'pending' });
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round) return;

  if (typeof payload.clue === 'string') {
    if (round.phase !== 'clueGiving' || playerId !== round.clueGiverId) return;
    const clue = payload.clue.trim();
    if (!clue) return;
    round.clue = clue;
    round.phase = 'guessing';
    const { left, right } = round.spectrum;
    // No target/number in here — safe for everyone, including the Clue
    // Giver, who already has their target cached client-side.
    const payloadOut = { phase: 'guessing', left, right, clue };
    broadcastGameUpdate(io, state, payloadOut);
    broadcastTvContent(io, state, payloadOut);
    return;
  }

  if (Number.isInteger(payload.guess)) {
    if (round.phase !== 'guessing' || playerId === round.clueGiverId) return;
    if (payload.guess < 1 || payload.guess > 10) return;
    if (round.guesses[playerId] !== undefined) return; // one guess per player

    round.guesses[playerId] = payload.guess;

    // Recomputed fresh each call, same disconnect-safety pattern as
    // higherLower/spyfall/imposter.
    const pending = guesserIds(state);
    const allGuessed = pending.every((id) => round.guesses[id] !== undefined);
    if (allGuessed) resolveRound(io, state);
  }
}

module.exports = { meta, start, stop, handleAction, handleAdminAction };
