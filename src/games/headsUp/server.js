// Loops for the whole game session, unlike Spyfall/Imposter's one-and-done
// round: pending -> admin picks a Guesser -> 60s active round -> back to
// pending for the next Guesser -> ... until the admin ends the game. /tv
// shows who's guessing and a running correct-count, never the word itself —
// unlike Spyfall/Imposter, the "secret" role here (the Guesser) is the one
// person in the room who'd see a shared screen while playing.
const meta = require('./meta');
const words = require('./words');
const {
  broadcastLeaderboard,
  broadcastGameUpdate,
  sendPlayerUpdate,
  broadcastTvContent,
  clearTvContent,
} = require('../../broadcast');
const { startTimer } = require('../../timer');

const MIN_PLAYERS = 2; // a Guesser and at least one person to give clues
const ROUND_SECONDS = 60; // specced explicitly in GAME_PLANS.md's timer-helper section
const ADVANCE_DEBOUNCE_MS = 600; // absorbs several bystanders tapping Correct for the same word at once

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
    lastAdvanceAt: 0,
  };
  broadcastGameUpdate(io, state, { phase: 'pending' });
}

function stop(io, state) {
  const round = state.activeGame.roundState;
  if (round && round.timerHandle) round.timerHandle.clear();
  clearTvContent(io, state);
  state.activeGame.roundState = null;
}

// The Guesser must never see the word, spectators always need it — so the
// word itself is always a per-player targeted send, never a room-wide
// broadcast (which would leak it to the Guesser's own socket, since they're
// in the same `players` room as everyone else).
function sendWordUpdates(io, state) {
  const round = state.activeGame.roundState;
  connectedPlayerIds(state).forEach((id) => {
    if (id === round.guesserId) {
      sendPlayerUpdate(io, state, id, { phase: 'active', role: 'guesser' });
    } else {
      sendPlayerUpdate(io, state, id, { phase: 'active', role: 'spectator', word: round.currentWord.text });
    }
  });
  // Room-wide (no word/role here — those went out above), so the admin
  // panel actually learns the round moved past 'pending' and swaps its
  // stale Guesser picker for the "Start Timer" button. Without this,
  // admin.js never receives another game:update until the timer starts (if
  // ever), left showing picker buttons that no longer do anything — same
  // bug Spyfall/Imposter had.
  broadcastGameUpdate(io, state, { phase: 'active' });
  // /tv gets a safe, secret-free "who's up / how many so far" tally — never
  // the word itself, unlike Spyfall's location deck or Imposter's clue log:
  // those are safe for their "secret" role to see too, but the Guesser
  // seeing the word on a shared screen would break the entire game.
  const guesser = state.players[round.guesserId];
  broadcastTvContent(io, state, {
    phase: 'active',
    guesserName: guesser ? guesser.name : null,
    correctCount: round.correctCount,
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
  clearTvContent(io, state);
  broadcastLeaderboard(io, state);
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round || round.phase !== 'active') return;

  // The Guesser can only Pass — they can't see the word, so they have no
  // way to judge a correct guess themselves. Marking one correct is for the
  // bystanders, who can both see the word and hear it get guessed.
  if (payload.pass) {
    if (playerId !== round.guesserId) return;
  } else if (payload.correct) {
    if (playerId === round.guesserId) return;
    const player = state.players[playerId];
    if (!player || !player.connected) return;
  } else {
    return;
  }

  // Several bystanders can plausibly tap Correct for the very same word
  // within moments of each other — without this, each tap would advance
  // (and score) the round again, skipping multiple words for one guess.
  const now = Date.now();
  if (now - round.lastAdvanceAt < ADVANCE_DEBOUNCE_MS) return;
  round.lastAdvanceAt = now;

  if (payload.correct) round.correctCount += 1;
  round.currentWord = pickNextWord(round.usedWordIds);
  sendWordUpdates(io, state);
}

module.exports = { meta, start, stop, handleAction, handleAdminAction };
