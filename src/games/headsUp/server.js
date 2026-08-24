// Loops for the whole game session, unlike Spyfall/Imposter's one-and-done
// round: pending -> admin picks a Guesser -> 60s active round -> back to
// pending for the next Guesser -> ... until the admin ends the game.
const meta = require('./meta');
const words = require('./words');
const { broadcastLeaderboard, broadcastGameUpdate, sendPlayerUpdate } = require('../../broadcast');
const { startTimer } = require('../../timer');

const MIN_PLAYERS = 2; // a Guesser and at least one person to give clues
const ROUND_SECONDS = 60; // specced explicitly in GAME_PLANS.md's timer-helper section

function connectedPlayerIds(state) {
  return Object.values(state.players).filter((p) => p.connected).map((p) => p.id);
}

// Same "avoid immediate repeats, recycle once exhausted" shape as
// higherLower's pickNextItem — the pool needs to outlast a fast 60s round.
function pickNextWord(usedIds) {
  const unused = words.filter((w) => !usedIds.has(w.id));
  const pool = unused.length > 0 ? unused : words;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  usedIds.add(picked.id);
  return picked;
}

function start(io, state) {
  state.activeGame.roundState = {
    phase: 'pending', // pending -> active -> pending -> ...
    guesserId: null,
    currentWord: null,
    usedWordIds: new Set(),
    correctCount: 0,
    timerHandle: null,
  };
  broadcastGameUpdate(io, state, { phase: 'pending' });
}

function stop(io, state) {
  const round = state.activeGame.roundState;
  if (round && round.timerHandle) round.timerHandle.clear();
  state.activeGame.roundState = null;
}

// The Guesser must never see the word, spectators always need it — so this
// is always per-player targeted sends, never a room-wide broadcast (which
// would leak the word to the Guesser's own socket, since they're in the same
// `players` room as everyone else).
function sendWordUpdates(io, state) {
  const round = state.activeGame.roundState;
  connectedPlayerIds(state).forEach((id) => {
    if (id === round.guesserId) {
      sendPlayerUpdate(io, state, id, { phase: 'active', role: 'guesser' });
    } else {
      sendPlayerUpdate(io, state, id, { phase: 'active', role: 'spectator', word: round.currentWord.text });
    }
  });
}

function handleAdminAction(io, state, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round) return;

  if (payload.type === 'assignRole') {
    if (round.phase !== 'pending') return;
    if (connectedPlayerIds(state).length < MIN_PLAYERS) return;
    const guesser = state.players[payload.playerId];
    if (!guesser || !guesser.connected) return;

    round.guesserId = guesser.id;
    round.currentWord = pickNextWord(round.usedWordIds);
    round.correctCount = 0;
    round.phase = 'active';
    sendWordUpdates(io, state);
    return;
  }

  if (payload.type === 'startTimer') {
    if (round.phase !== 'active' || round.timerHandle || !round.guesserId) return;
    const handle = startTimer(io, state, {
      seconds: ROUND_SECONDS,
      label: "Guesser's time",
      onComplete: () => endRound(io, state),
    });
    round.timerHandle = handle;
    // No word/role here — safe to broadcast to everyone, including the
    // Guesser. Each client already has its own role/word cached from the
    // targeted sends above.
    broadcastGameUpdate(io, state, { phase: 'active', timer: handle.timer });
  }
}

function endRound(io, state) {
  const round = state.activeGame.roundState;
  if (round.timerHandle) {
    round.timerHandle.clear();
    round.timerHandle = null;
  }

  const guesser = state.players[round.guesserId];
  const correctCount = round.correctCount;
  if (guesser) guesser.score += correctCount;

  round.phase = 'pending';
  round.guesserId = null;
  round.currentWord = null;
  round.correctCount = 0;

  broadcastGameUpdate(io, state, {
    phase: 'pending',
    lastRoundGuesserName: guesser ? guesser.name : null,
    lastRoundCorrectCount: correctCount,
  });
  broadcastLeaderboard(io, state);
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round || round.phase !== 'active' || playerId !== round.guesserId) return;
  if (!payload.correct && !payload.pass) return;

  if (payload.correct) round.correctCount += 1;
  round.currentWord = pickNextWord(round.usedWordIds);
  sendWordUpdates(io, state);
}

module.exports = { meta, start, stop, handleAction, handleAdminAction };
