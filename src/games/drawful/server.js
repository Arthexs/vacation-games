// Telephone-style chain game (like Gartic Phone): every player starts their
// own "book" with a written prompt, then each round every book gets passed
// to a different player who alternately draws the last entry or writes what
// they think the last drawing shows. With n connected players the game runs
// exactly n rounds, so every book passes through every player exactly once
// (round 0 = the owner's own prompt) — the rotation `bookIndex = (i - round)
// mod n` guarantees each player touches a different book every round and
// never repeats one. Unlike the old vote-based Drawful, players never see a
// chain's full history, only the single entry immediately before theirs —
// that's what makes the final reveal (played back book by book, entry by
// entry) worth watching. Because every player is busy on a different book
// every round, there's no single shared "drawing" to put on /tv during
// rounds — the TV content override only kicks in for the reveal itself.
const meta = require('./meta');
const {
  broadcastLeaderboard,
  broadcastGameUpdate,
  sendPlayerUpdate,
  broadcastTvContent,
  clearTvContent,
} = require('../../broadcast');
const { startTimer } = require('../../timer');

const WRITE_SECONDS = 45;
const DRAW_SECONDS = 75;
const VOTE_SECONDS = 20;
const SUBMIT_POINTS = 1; // flat participation point per entry submitted
const FAVORITE_CHAIN_POINTS = 3; // per vote received, awarded to that chain's owner in the closing vote

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

function entryTypeForRound(roundIndex) {
  return roundIndex % 2 === 0 ? 'write' : 'draw';
}

function bookIndexForPlayer(round, playerIndex) {
  const n = round.playerOrder.length;
  return ((playerIndex - round.currentRound) % n + n) % n;
}

function start(io, state) {
  const playerOrder = shuffle(connectedPlayerIds(state));
  const n = playerOrder.length;

  if (n === 0) {
    state.activeGame.roundState = null;
    broadcastGameUpdate(io, state, { phase: 'gameOver', noPlayers: true });
    return;
  }

  const books = {};
  playerOrder.forEach((id) => { books[id] = { ownerId: id, entries: [] }; });

  state.activeGame.roundState = {
    phase: 'pending', // pending -> write/draw (loop, n rounds) -> reveal -> vote -> gameOver
    playerOrder, // fixed for the whole session; also the book-reveal order
    totalRounds: n,
    currentRound: 0,
    books, // ownerId -> { ownerId, entries: [{type: 'write'|'draw', by, text?, drawingDataUrl?}] }
    submissions: {}, // playerId -> true, reset each round
    timerHandle: null,
    revealBookIndex: 0,
    revealEntryIndex: 0,
    chainVotes: {}, // voterPlayerId -> the chain-owner playerId they voted for
  };

  broadcastGameUpdate(io, state, { phase: 'pending', totalRounds: n });
}

function stop(io, state) {
  const round = state.activeGame.roundState;
  if (round && round.timerHandle) round.timerHandle.clear();
  clearTvContent(io, state);
  state.activeGame.roundState = null;
}

function beginRound(io, state, roundIndex) {
  const round = state.activeGame.roundState;
  round.currentRound = roundIndex;
  round.submissions = {};
  const entryType = entryTypeForRound(roundIndex);
  round.phase = entryType;

  round.playerOrder.forEach((playerId, i) => {
    const book = round.books[round.playerOrder[bookIndexForPlayer(round, i)]];
    const prevEntry = book.entries[book.entries.length - 1] || null;
    sendPlayerUpdate(io, state, playerId, {
      phase: entryType,
      currentRound: roundIndex,
      totalRounds: round.totalRounds,
      isFirstEntry: roundIndex === 0,
      prevEntry,
    });
  });

  round.timerHandle = startTimer(io, state, {
    seconds: entryType === 'draw' ? DRAW_SECONDS : WRITE_SECONDS,
    label: entryType === 'draw' ? 'Drawing time' : 'Writing time',
    onComplete: () => closeRound(io, state),
  });
  // No entry content here — safe to broadcast; each player already cached
  // their own private assignment from the sendPlayerUpdate loop above.
  broadcastGameUpdate(io, state, {
    phase: entryType,
    currentRound: roundIndex,
    totalRounds: round.totalRounds,
    timer: round.timerHandle.timer,
  });
}

function closeRound(io, state) {
  const round = state.activeGame.roundState;
  if (round.timerHandle) {
    round.timerHandle.clear();
    round.timerHandle = null;
  }
  broadcastLeaderboard(io, state);
  if (round.currentRound + 1 >= round.totalRounds) {
    startReveal(io, state);
    return;
  }
  beginRound(io, state, round.currentRound + 1);
}

function broadcastReveal(io, state) {
  const round = state.activeGame.roundState;
  const bookId = round.playerOrder[round.revealBookIndex];
  const book = round.books[bookId];
  const owner = state.players[bookId];
  const entries = book.entries.slice(0, round.revealEntryIndex + 1).map((e) => ({
    type: e.type,
    text: e.text || null,
    drawingDataUrl: e.drawingDataUrl || null,
    authorName: state.players[e.by] ? state.players[e.by].name : '???',
  }));
  const payload = {
    phase: 'reveal',
    chainNumber: round.revealBookIndex + 1,
    totalChains: round.playerOrder.length,
    ownerName: owner ? owner.name : '???',
    entries,
  };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
}

function startReveal(io, state) {
  const round = state.activeGame.roundState;
  round.phase = 'reveal';
  round.revealBookIndex = 0;
  round.revealEntryIndex = 0;
  broadcastReveal(io, state);
}

function revealNext(io, state) {
  const round = state.activeGame.roundState;
  const book = round.books[round.playerOrder[round.revealBookIndex]];
  if (round.revealEntryIndex + 1 < book.entries.length) {
    round.revealEntryIndex += 1;
    broadcastReveal(io, state);
    return;
  }
  if (round.revealBookIndex + 1 < round.playerOrder.length) {
    round.revealBookIndex += 1;
    round.revealEntryIndex = 0;
    broadcastReveal(io, state);
    return;
  }
  startChainVote(io, state);
}

// Closing vote: every player picks their favorite chain (identified by
// whoever started it) other than their own. Skipped entirely with fewer than
// two players since there'd be no valid choice to vote for.
function startChainVote(io, state) {
  const round = state.activeGame.roundState;
  if (round.playerOrder.length < 2) {
    finishGame(io, state, []);
    return;
  }

  round.phase = 'vote';
  round.chainVotes = {};
  const options = round.playerOrder.map((id) => ({
    id,
    ownerName: state.players[id] ? state.players[id].name : '???',
  }));

  round.timerHandle = startTimer(io, state, {
    seconds: VOTE_SECONDS,
    label: 'Vote for your favorite chain',
    onComplete: () => closeChainVote(io, state),
  });
  const payload = { phase: 'vote', options, timer: round.timerHandle.timer };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
}

function closeChainVote(io, state) {
  const round = state.activeGame.roundState;
  if (round.timerHandle) {
    round.timerHandle.clear();
    round.timerHandle = null;
  }

  const voteCounts = {};
  round.playerOrder.forEach((id) => { voteCounts[id] = 0; });
  Object.values(round.chainVotes).forEach((votedForId) => {
    voteCounts[votedForId] = (voteCounts[votedForId] || 0) + 1;
  });
  round.playerOrder.forEach((id) => {
    const votes = voteCounts[id];
    if (votes > 0 && state.players[id]) state.players[id].score += votes * FAVORITE_CHAIN_POINTS;
  });

  const voteResults = round.playerOrder
    .map((id) => ({ ownerId: id, ownerName: state.players[id] ? state.players[id].name : '???', votes: voteCounts[id] }))
    .sort((a, b) => b.votes - a.votes);
  finishGame(io, state, voteResults);
}

function finishGame(io, state, voteResults) {
  const round = state.activeGame.roundState;
  round.phase = 'gameOver';
  broadcastLeaderboard(io, state);
  const payload = { phase: 'gameOver', voteResults };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
}

function handleAdminAction(io, state, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round) return;

  if (payload.type === 'startTimer') {
    if (round.phase !== 'pending' || round.timerHandle) return;
    beginRound(io, state, 0);
    return;
  }

  if (payload.type === 'revealNext') {
    if (round.phase !== 'reveal') return;
    revealNext(io, state);
  }
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round) return;

  if (round.phase === 'vote') {
    if (typeof payload.voteFor !== 'string') return;
    if (payload.voteFor === playerId) return; // can't vote for your own chain
    if (round.chainVotes[playerId]) return;
    if (!round.playerOrder.includes(payload.voteFor)) return;
    round.chainVotes[playerId] = payload.voteFor;
    const requiredVoters = round.playerOrder.filter((id) => state.players[id] && state.players[id].connected);
    if (requiredVoters.every((id) => round.chainVotes[id])) closeChainVote(io, state);
    return;
  }

  if (round.phase !== 'write' && round.phase !== 'draw') return;
  if (round.submissions[playerId]) return;

  const i = round.playerOrder.indexOf(playerId);
  if (i === -1) return; // joined after the chain started — no assigned book this game
  const book = round.books[round.playerOrder[bookIndexForPlayer(round, i)]];

  if (round.phase === 'write') {
    if (typeof payload.text !== 'string') return;
    const text = payload.text.trim();
    if (!text) return;
    book.entries.push({ type: 'write', by: playerId, text });
  } else {
    if (typeof payload.drawingDataUrl !== 'string') return;
    book.entries.push({ type: 'draw', by: playerId, drawingDataUrl: payload.drawingDataUrl });
  }

  round.submissions[playerId] = true;
  if (state.players[playerId]) state.players[playerId].score += SUBMIT_POINTS;

  const requiredIds = round.playerOrder.filter((id) => state.players[id] && state.players[id].connected);
  if (requiredIds.every((id) => round.submissions[id])) closeRound(io, state);
}

module.exports = { meta, start, stop, handleAction, handleAdminAction };
