// Every player guesses every round, simultaneously — no admin-assigned role,
// no timer (v1 waits for all connected players to answer instead; see
// GAME_PLANS.md's "Higher or Lower" spec for the open calls this resolves).
const meta = require('./meta');
const items = require('./items');
const { broadcastLeaderboard, broadcastGameUpdate } = require('../../broadcast');

const MAX_STREAK_MULTIPLIER = 5; // points per correct guess = min(streak, this)
const REVEAL_PAUSE_MS = 3000; // time to see the reveal before the next round starts

function pickRandomItem(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

// Avoids repeating `excludeId` immediately and prefers items not yet shown
// this game session; once the pool's exhausted, starts recycling.
function pickNextItem(pool, excludeId, usedIds) {
  const unused = pool.filter((item) => item.id !== excludeId && !usedIds.has(item.id));
  const candidates = unused.length > 0 ? unused : pool.filter((item) => item.id !== excludeId);
  const picked = pickRandomItem(candidates);
  usedIds.add(picked.id);
  return picked;
}

function publicItem(item) {
  return { name: item.name, image: item.image, value: item.value };
}

function hiddenItem(item) {
  return { name: item.name, image: item.image };
}

function broadcastGuessingPhase(io, state) {
  const round = state.activeGame.roundState;
  broadcastGameUpdate(io, state, {
    phase: 'guessing',
    current: publicItem(round.currentItem),
    next: hiddenItem(round.nextItem),
  });
}

function startNextRound(io, state) {
  const round = state.activeGame.roundState;
  round.revealTimeoutId = null;
  round.currentItem = round.nextItem;
  round.nextItem = pickNextItem(items, round.currentItem.id, round.usedIds);
  round.answers = {};
  broadcastGuessingPhase(io, state);
}

function resolveRound(io, state) {
  const round = state.activeGame.roundState;
  const { currentItem, nextItem, answers, streaks } = round;

  // Not expected to trigger with this dataset's all-distinct elevations, but
  // handled anyway: a tie means nobody was right, streaks just reset.
  let actual;
  if (nextItem.value > currentItem.value) actual = 'higher';
  else if (nextItem.value < currentItem.value) actual = 'lower';
  else actual = 'tie';

  const results = {};
  Object.entries(answers).forEach(([playerId, guess]) => {
    const player = state.players[playerId];
    if (!player) return;
    const correct = guess === actual;
    streaks[playerId] = correct ? (streaks[playerId] || 0) + 1 : 0;
    const pointsEarned = correct ? Math.min(streaks[playerId], MAX_STREAK_MULTIPLIER) : 0;
    player.score += pointsEarned;
    results[playerId] = { guess, correct, streak: streaks[playerId], pointsEarned };
  });

  broadcastGameUpdate(io, state, {
    phase: 'reveal',
    current: publicItem(currentItem),
    next: publicItem(nextItem),
    actual,
    results,
  });
  broadcastLeaderboard(io, state);

  round.revealTimeoutId = setTimeout(() => {
    round.revealTimeoutId = null;
    if (round.pendingFinish) {
      const finish = round.pendingFinish;
      round.pendingFinish = null;
      finish();
    } else {
      startNextRound(io, state);
    }
  }, REVEAL_PAUSE_MS);
}

// Lets admin:endGame finish the round already in progress instead of
// silently discarding it mid-flight. Doesn't force an early resolution —
// that would skip straight to the reveal for whoever hasn't answered yet,
// which looks like their answer got filled in for them. Just flags it and
// waits: if the round is still being answered, handleAction's normal "all
// connected players have answered" check resolves it in due course; if it's
// already resolved and sitting in the reveal pause, the scheduled callback
// above picks up pendingFinish once that pause ends.
function requestStop(io, state, finish) {
  const round = state.activeGame.roundState;
  if (!round) {
    finish();
    return;
  }
  round.pendingFinish = finish;
}

function start(io, state) {
  const firstItem = pickRandomItem(items);
  const usedIds = new Set([firstItem.id]);
  state.activeGame.roundState = {
    currentItem: firstItem,
    nextItem: pickNextItem(items, firstItem.id, usedIds),
    answers: {}, // playerId -> 'higher' | 'lower', reset each round
    streaks: {}, // playerId -> current streak, persists across rounds this game session
    usedIds,
    revealTimeoutId: null, // set while waiting between reveal and the next round
  };
  broadcastGuessingPhase(io, state);
}

function stop(io, state) {
  const round = state.activeGame.roundState;
  if (round && round.revealTimeoutId) clearTimeout(round.revealTimeoutId);
  state.activeGame.roundState = null;
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  const player = state.players[playerId];
  if (!round || !player) return;
  if (payload.guess !== 'higher' && payload.guess !== 'lower') return;
  if (round.answers[playerId]) return; // one guess per round
  if (round.revealTimeoutId) return; // already resolved, waiting on the next round

  round.answers[playerId] = payload.guess;

  // Recomputed fresh each call (not a snapshot taken at round start) so a
  // player disconnecting while others are still waiting on them doesn't
  // stall the round forever. The one gap this doesn't cover: if literally
  // every remaining unanswered player disconnects, there's no more
  // player:action to re-run this check until the admin ends the round —
  // there's no core hook for "a player disconnected mid-round" today.
  const connectedIds = Object.values(state.players)
    .filter((p) => p.connected)
    .map((p) => p.id);
  const allAnswered = connectedIds.every((id) => round.answers[id]);
  if (allAnswered) resolveRound(io, state);
}

module.exports = { meta, start, stop, handleAction, requestStop };
