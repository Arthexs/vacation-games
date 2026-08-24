// No roles — every player guesses and bets simultaneously each question.
// Loops automatically to a new question after each reveal (like
// higherLower), but unlike higherLower, both windows are admin-gated: the
// admin explicitly starts the guess timer and the bet timer for every single
// question, per GAME_PLANS.md's admin-triggered-timer rule (no exception
// carved out for this game the way there was for higherLower).
const meta = require('./meta');
const questions = require('./questions');
const {
  broadcastLeaderboard,
  broadcastGameUpdate,
  broadcastTvContent,
  clearTvContent,
} = require('../../broadcast');
const { startTimer } = require('../../timer');

const GUESS_SECONDS = 30; // not specced — a reasonable v1 default
const BET_SECONDS = 30;
const PAYOUT_MULTIPLIER = 2; // flat payout per GAME_PLANS.md's own "start simple" suggestion
const REVEAL_PAUSE_MS = 4000;

function connectedPlayerIds(state) {
  return Object.values(state.players).filter((p) => p.connected).map((p) => p.id);
}

// Sorted, deduped-by-value "slots" — the shared board. Multiple players who
// guessed the same number share one slot, same as real Wits & Wagers.
function buildSlots(state, guesses) {
  const byValue = new Map();
  Object.entries(guesses).forEach(([playerId, value]) => {
    if (!byValue.has(value)) byValue.set(value, []);
    byValue.get(value).push(playerId);
  });
  return [...byValue.entries()]
    .sort(([a], [b]) => a - b)
    .map(([value, playerIds]) => ({
      value,
      playerIds,
      playerNames: playerIds.map((id) => (state.players[id] ? state.players[id].name : '?')),
    }));
}

// Closest without going over; if every slot overshoots the answer, the
// lowest slot wins instead (a common house rule for this edge case — not
// specced, decided here).
function findWinningSlot(slots, answer) {
  const notOver = slots.filter((s) => s.value <= answer);
  if (notOver.length > 0) return notOver[notOver.length - 1]; // slots are sorted ascending
  return slots[0] || null;
}

function pickQuestion(usedIds) {
  const unused = questions.filter((q) => !usedIds.has(q.id));
  const pool = unused.length > 0 ? unused : questions;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  usedIds.add(picked.id);
  return picked;
}

function broadcastGuessPhase(io, state) {
  const round = state.activeGame.roundState;
  broadcastGameUpdate(io, state, { phase: 'guessing', question: round.question.question });
  broadcastTvContent(io, state, { phase: 'guessing', question: round.question.question });
}

function startNextQuestion(io, state) {
  const round = state.activeGame.roundState;
  round.question = pickQuestion(round.usedQuestionIds);
  round.guesses = {};
  round.bets = {};
  round.slots = [];
  round.phase = 'guessing';
  round.timerHandle = null;
  round.revealTimeoutId = null;
  broadcastGuessPhase(io, state);
}

function start(io, state) {
  const usedQuestionIds = new Set();
  const question = pickQuestion(usedQuestionIds);
  state.activeGame.roundState = {
    phase: 'guessing', // guessing -> betting -> reveal -> guessing -> ...
    question,
    usedQuestionIds,
    guesses: {}, // playerId -> number
    bets: {}, // bettorPlayerId -> { betOnPlayerId, amount }
    slots: [],
    timerHandle: null,
    revealTimeoutId: null,
  };
  broadcastGuessPhase(io, state);
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

function openBetPhase(io, state) {
  const round = state.activeGame.roundState;
  round.timerHandle = null;
  round.slots = buildSlots(state, round.guesses);

  if (round.slots.length === 0) {
    // Nobody guessed — nothing to bet on. Reveal that plainly and move on
    // rather than opening a dead-end bet phase with no slots.
    round.phase = 'reveal';
    broadcastGameUpdate(io, state, { phase: 'reveal', question: round.question.question, answer: round.question.answer, noGuesses: true });
    broadcastTvContent(io, state, { phase: 'reveal', question: round.question.question, answer: round.question.answer, noGuesses: true });
    round.revealTimeoutId = setTimeout(() => startNextQuestion(io, state), REVEAL_PAUSE_MS);
    return;
  }

  round.phase = 'betting';
  const payload = { phase: 'betting', question: round.question.question, slots: round.slots };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
}

function resolveBets(io, state) {
  const round = state.activeGame.roundState;
  round.timerHandle = null;
  const winningSlot = findWinningSlot(round.slots, round.question.answer);

  const results = {};
  Object.entries(round.bets).forEach(([bettorId, bet]) => {
    const bettor = state.players[bettorId];
    if (!bettor) return;
    const won = winningSlot && round.guesses[bet.betOnPlayerId] === winningSlot.value;
    const payout = won ? bet.amount * PAYOUT_MULTIPLIER : 0;
    if (payout > 0) bettor.score += payout;
    results[bettorId] = { name: bettor.name, betOnPlayerId: bet.betOnPlayerId, amount: bet.amount, won, payout };
  });

  round.phase = 'reveal';
  const payload = {
    phase: 'reveal',
    question: round.question.question,
    answer: round.question.answer,
    winningValue: winningSlot ? winningSlot.value : null,
    results,
  };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
  broadcastLeaderboard(io, state);

  round.revealTimeoutId = setTimeout(() => startNextQuestion(io, state), REVEAL_PAUSE_MS);
}

function handleAdminAction(io, state, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round || payload.type !== 'startTimer' || round.timerHandle) return;

  if (round.phase === 'guessing') {
    round.timerHandle = startTimer(io, state, {
      seconds: GUESS_SECONDS,
      label: 'Lock in your guess',
      onComplete: () => openBetPhase(io, state),
    });
    broadcastGameUpdate(io, state, { phase: 'guessing', question: round.question.question, timer: round.timerHandle.timer });
    return;
  }

  if (round.phase === 'betting') {
    round.timerHandle = startTimer(io, state, {
      seconds: BET_SECONDS,
      label: 'Place your bet',
      onComplete: () => resolveBets(io, state),
    });
    broadcastGameUpdate(io, state, {
      phase: 'betting',
      question: round.question.question,
      slots: round.slots,
      timer: round.timerHandle.timer,
    });
  }
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  const player = state.players[playerId];
  if (!round || !player) return;

  if (round.phase === 'guessing' && typeof payload.guess === 'number' && Number.isFinite(payload.guess)) {
    round.guesses[playerId] = payload.guess;
    return;
  }

  if (round.phase === 'betting' && payload.betOnPlayerId) {
    if (round.bets[playerId]) return; // one bet per player
    // A player doesn't need to have guessed themselves to place a bet.
    if (round.guesses[payload.betOnPlayerId] === undefined) return; // must bet on an actual guess
    const amount = Math.floor(payload.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > player.score) return;

    round.bets[playerId] = { betOnPlayerId: payload.betOnPlayerId, amount };
  }
}

module.exports = { meta, start, stop, handleAction, handleAdminAction };
