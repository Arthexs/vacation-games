// One round per game session, turn-enforced clue-giving unlike Spyfall's free
// discussion. Self-contained (not sharing code with spyfall/server.js) per
// discussion — the two games' round shapes overlap but diverge enough
// (turn order vs. free discussion, no "guess the word" instant win) that
// duplicating was the simpler call. /tv shows the growing clue log (already
// public — nothing secret, same reasoning as Spyfall's location deck).
const meta = require('./meta');
const wordPairs = require('./wordPairs');
const {
  broadcastLeaderboard,
  broadcastGameUpdate,
  sendPlayerUpdate,
  broadcastTvContent,
  clearTvContent,
} = require('../../broadcast');

const MIN_PLAYERS = 3; // below this, turn-based clue-giving isn't meaningful
const LAPS = 2; // full trips around the turn order before voting opens — not specced
const CATCH_POINTS = 1; // each non-imposter player, if the group votes out the Imposter
const IMPOSTER_WIN_POINTS = 5; // the Imposter, if the vote is split or wrong

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
  const pair = wordPairs[Math.floor(Math.random() * wordPairs.length)];
  state.activeGame.roundState = {
    phase: 'pending', // pending -> clues -> voting -> reveal
    pair,
    imposterId: null,
    turnOrder: [], // snapshot of connected player ids at assignRole time — a
    // player who joins mid-round isn't added to it, and just watches.
    currentTurnIndex: 0,
    lapsCompleted: 0,
    clueLog: [],
    votes: {},
  };
  broadcastGameUpdate(io, state, { phase: 'pending' });
}

function stop(io, state) {
  clearTvContent(io, state);
  state.activeGame.roundState = null;
}

// No secrets in a clue-log update — safe to broadcast room-wide (and to
// /tv). Each player's own role/word was already delivered privately at
// assignRole time (see handleAdminAction) and is expected to be cached
// client-side.
function broadcastCluePhase(io, state) {
  const round = state.activeGame.roundState;
  const currentTurnId = round.turnOrder[round.currentTurnIndex];
  const currentTurnPlayer = state.players[currentTurnId];
  const payload = {
    phase: 'clues',
    clueLog: round.clueLog,
    currentTurnId,
    currentTurnName: currentTurnPlayer ? currentTurnPlayer.name : null,
  };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
}

function handleAdminAction(io, state, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round || payload.type !== 'assignRole') return;
  if (round.phase !== 'pending') return;

  const connectedIds = connectedPlayerIds(state);
  if (connectedIds.length < MIN_PLAYERS) return;
  const imposter = state.players[payload.playerId];
  if (!imposter || !imposter.connected) return;

  round.imposterId = imposter.id;
  round.turnOrder = shuffle(connectedIds);
  round.currentTurnIndex = 0;
  round.phase = 'clues';

  const currentTurnId = round.turnOrder[0];
  connectedIds.forEach((id) => {
    if (id === imposter.id) {
      sendPlayerUpdate(io, state, id, { phase: 'clues', role: 'imposter', word: round.pair.decoy, clueLog: [], currentTurnId });
    } else {
      sendPlayerUpdate(io, state, id, { phase: 'clues', role: 'player', word: round.pair.real, clueLog: [], currentTurnId });
    }
  });
  // Room-wide (no word/role — those went out above), so the admin panel
  // actually learns the round moved past 'pending' and swaps its stale
  // Imposter picker for the "clue round in progress" message, and so /tv
  // can show the clue log. Without this, admin.js never receives another
  // game:update until the first clue is submitted (if ever), and is left
  // showing picker buttons that no longer do anything — round.phase is
  // already 'clues' by the time they're clicked again. Same bug Spyfall had.
  broadcastCluePhase(io, state);
}

function resolveVote(io, state) {
  const round = state.activeGame.roundState;
  const connectedIds = connectedPlayerIds(state);

  const tally = {};
  Object.values(round.votes).forEach((targetId) => {
    tally[targetId] = (tally[targetId] || 0) + 1;
  });
  let topId = null;
  let topCount = 0;
  let tied = false;
  Object.entries(tally).forEach(([id, count]) => {
    if (count > topCount) {
      topId = id;
      topCount = count;
      tied = false;
    } else if (count === topCount) {
      tied = true;
    }
  });

  const caught = !tied && topId === round.imposterId;
  round.phase = 'reveal';
  const imposter = state.players[round.imposterId];
  if (caught) {
    connectedIds.forEach((id) => {
      if (id !== round.imposterId) state.players[id].score += CATCH_POINTS;
    });
  } else if (imposter) {
    imposter.score += IMPOSTER_WIN_POINTS;
  }

  broadcastGameUpdate(io, state, {
    phase: 'reveal',
    word: round.pair.real,
    decoyWord: round.pair.decoy,
    imposterId: round.imposterId,
    imposterName: imposter ? imposter.name : null,
    votes: round.votes,
    outcome: caught ? 'caught' : 'escaped',
  });
  broadcastTvContent(io, state, {
    phase: 'reveal',
    clueLog: round.clueLog,
    word: round.pair.real,
    decoyWord: round.pair.decoy,
    imposterName: imposter ? imposter.name : null,
    outcome: caught ? 'caught' : 'escaped',
  });
  broadcastLeaderboard(io, state);
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  const player = state.players[playerId];
  if (!round || !player) return;

  if (typeof payload.clue === 'string') {
    if (round.phase !== 'clues') return;
    if (round.turnOrder[round.currentTurnIndex] !== playerId) {
      sendPlayerUpdate(io, state, playerId, {
        phase: 'clues',
        notYourTurn: true,
        clueLog: round.clueLog,
        currentTurnId: round.turnOrder[round.currentTurnIndex],
      });
      return;
    }
    const clue = payload.clue.trim();
    if (!clue) return;

    round.clueLog.push({ playerId, name: player.name, clue });
    round.currentTurnIndex += 1;
    if (round.currentTurnIndex >= round.turnOrder.length) {
      round.currentTurnIndex = 0;
      round.lapsCompleted += 1;
    }

    if (round.lapsCompleted >= LAPS) {
      round.phase = 'voting';
      round.votes = {};
      const votingPayload = { phase: 'voting', clueLog: round.clueLog };
      broadcastGameUpdate(io, state, votingPayload);
      broadcastTvContent(io, state, votingPayload);
      return;
    }

    broadcastCluePhase(io, state);
    return;
  }

  if (payload.vote) {
    if (round.phase !== 'voting') return;
    if (payload.vote === playerId) return; // no self-votes
    if (!state.players[payload.vote]) return;
    if (round.votes[playerId]) return; // one vote per player

    round.votes[playerId] = payload.vote;

    // Recomputed fresh each call so a disconnecting voter can't stall the
    // round forever — same pattern as higherLower/spyfall.
    const connectedIds = connectedPlayerIds(state);
    const allVoted = connectedIds.every((id) => round.votes[id]);
    if (allVoted) resolveVote(io, state);
  }
}

module.exports = { meta, start, stop, handleAction, handleAdminAction };
