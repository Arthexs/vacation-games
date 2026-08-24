// One round per game session (start a fresh round by ending and re-selecting
// this game) — assign the Spy, discuss, vote, reveal. No TV takeover: this is
// a phone-only social game (see GAME_PLANS.md's Spyfall spec).
const meta = require('./meta');
const locations = require('./locations');
const { broadcastLeaderboard, broadcastGameUpdate, sendPlayerUpdate } = require('../../broadcast');
const { startTimer } = require('../../timer');

const MIN_PLAYERS = 3; // below this, "find the Spy" isn't meaningful
const DISCUSSION_SECONDS = 300; // 5 minutes — not specced, a reasonable v1 default
const CATCH_POINTS = 1; // each non-spy player, if the group votes out the Spy
const SPY_WIN_POINTS = 2; // the Spy, if they escape the vote or guess the location

function connectedPlayerIds(state) {
  return Object.values(state.players).filter((p) => p.connected).map((p) => p.id);
}

function start(io, state) {
  const location = locations[Math.floor(Math.random() * locations.length)];
  state.activeGame.roundState = {
    phase: 'pending', // pending -> discussion -> voting -> reveal
    location,
    spyId: null,
    votes: {}, // playerId -> the playerId they voted for
    timerHandle: null,
  };
  // No secrets yet — safe to broadcast room-wide. Tells phones/tv-adjacent
  // admin to show "waiting for the gamemaster to pick a Spy."
  broadcastGameUpdate(io, state, { phase: 'pending' });
}

function stop(io, state) {
  const round = state.activeGame.roundState;
  if (round && round.timerHandle) round.timerHandle.clear();
  state.activeGame.roundState = null;
}

function revealAndScore(io, state, outcome) {
  const round = state.activeGame.roundState;
  if (round.timerHandle) {
    round.timerHandle.clear();
    round.timerHandle = null;
  }
  round.phase = 'reveal';

  const spy = state.players[round.spyId];
  if (outcome === 'caught') {
    connectedPlayerIds(state).forEach((id) => {
      if (id === round.spyId) return;
      state.players[id].score += CATCH_POINTS;
    });
  } else {
    // 'escaped' (vote missed/tied) or 'guessedLocation'
    if (spy) spy.score += SPY_WIN_POINTS;
  }

  broadcastGameUpdate(io, state, {
    phase: 'reveal',
    location: round.location.name,
    spyId: round.spyId,
    spyName: spy ? spy.name : null,
    votes: round.votes,
    outcome,
  });
  broadcastLeaderboard(io, state);
}

function openVote(io, state) {
  const round = state.activeGame.roundState;
  round.phase = 'voting';
  round.votes = {};
  // No location/role info in this payload — safe to broadcast to everyone,
  // including the Spy.
  broadcastGameUpdate(io, state, { phase: 'voting' });
}

function handleAdminAction(io, state, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round) return;

  if (payload.type === 'assignRole') {
    if (round.phase !== 'pending') return;
    if (connectedPlayerIds(state).length < MIN_PLAYERS) return;
    const spy = state.players[payload.playerId];
    if (!spy || !spy.connected) return;

    round.spyId = spy.id;
    round.phase = 'discussion';

    // Per-player targeted sends, not a broadcast + override — the Spy must
    // never see the location. Known gap: unlike broadcastGameUpdate, these
    // aren't stashed for reconnect replay, so a player whose phone drops
    // mid-discussion won't get their role/location back automatically.
    connectedPlayerIds(state).forEach((id) => {
      if (id === spy.id) {
        // The Spy sees the full location deck to guess from — same idea as
        // real Spyfall's location card, not itself a secret.
        sendPlayerUpdate(io, state, id, { phase: 'discussion', role: 'spy', locations });
      } else {
        sendPlayerUpdate(io, state, id, { phase: 'discussion', role: 'player', location: round.location.name });
      }
    });
    return;
  }

  if (payload.type === 'startTimer') {
    if (round.phase !== 'discussion' || round.timerHandle) return;
    const handle = startTimer(io, state, {
      seconds: DISCUSSION_SECONDS,
      label: 'Discussion',
      onComplete: () => openVote(io, state),
    });
    round.timerHandle = handle;
    // No location/role here either — safe to broadcast. Players already have
    // their own role/location from the sendPlayerUpdate above.
    broadcastGameUpdate(io, state, { phase: 'discussion', timer: handle.timer });
  }
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  const player = state.players[playerId];
  if (!round || !player) return;

  if (payload.guessLocation) {
    if (round.phase !== 'discussion' || playerId !== round.spyId) return;
    if (payload.guessLocation === round.location.id) {
      revealAndScore(io, state, 'guessedLocation');
    } else {
      sendPlayerUpdate(io, state, playerId, { phase: 'discussion', role: 'spy', locations, wrongGuess: true });
    }
    return;
  }

  if (payload.vote) {
    if (round.phase !== 'voting') return;
    if (payload.vote === playerId) return; // no self-votes
    if (!state.players[payload.vote]) return;
    if (round.votes[playerId]) return; // one vote per player

    round.votes[playerId] = payload.vote;

    // Recomputed fresh each call so a disconnecting voter can't stall the
    // round forever — same pattern as higherLower's answer-waiting check.
    const connectedIds = connectedPlayerIds(state);
    const allVoted = connectedIds.every((id) => round.votes[id]);
    if (!allVoted) return;

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

    revealAndScore(io, state, !tied && topId === round.spyId ? 'caught' : 'escaped');
  }
}

module.exports = { meta, start, stop, handleAction, handleAdminAction };
