// Template for every future game module: meta + start(io, state) + stop(io, state)
// + handleAction(io, state, playerId, payload) for its own player:action events.
const meta = require('./meta');
const { broadcastLeaderboard, broadcastGameUpdate } = require('../../broadcast');

const QUESTION = {
  text: 'What is the capital of France?',
  options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
  correctIndex: 2,
};

function start(io, state) {
  // roundState is this game's own scratch space — the core server never reads it.
  state.activeGame.roundState = {
    answeredPlayerIds: new Set(), // one guess per player
    winnerId: null,
  };

  broadcastGameUpdate(io, state, {
    question: QUESTION.text,
    options: QUESTION.options,
  });
}

function stop(io, state) {
  // Correct guesses already folded their point into players[id].score in
  // handleAction below, so there's nothing left to fold in here — just tear down.
  state.activeGame.roundState = null;
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  const player = state.players[playerId];
  if (!round || !player || round.winnerId || round.answeredPlayerIds.has(playerId)) return;

  round.answeredPlayerIds.add(playerId);

  if (payload.optionIndex === QUESTION.correctIndex) {
    round.winnerId = playerId;
    player.score += 1;
    broadcastGameUpdate(io, state, {
      question: QUESTION.text,
      options: QUESTION.options,
      resolved: true,
      winnerName: player.name,
    });
    broadcastLeaderboard(io, state);
  } else {
    // Only this player gets the "wrong guess" update — everyone else's screen is untouched.
    io.to(player.socketId).emit('game:update', {
      question: QUESTION.text,
      options: QUESTION.options,
      wrongGuess: true,
      answered: true,
    });
  }
}

module.exports = { meta, start, stop, handleAction };
