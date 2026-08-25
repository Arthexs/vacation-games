// Fibbage-style bluffing game (the mechanic Psych! itself is built on):
// unlike Drawful, there's no per-player "artist" turn — a single trivia
// question is shared by the whole room each round, so nothing here is ever
// sent privately (no sendPlayerUpdate at all). Only the very first question's
// answer-writing timer is admin-triggered, so the group can read the
// question and settle in before the clock starts; every phase after that
// (vote, results, and every question after the first) auto-chains, since
// requiring an admin tap before each of many back-to-back questions would
// get repetitive fast — same trade-off Drawful's title/vote phases made.
// The question deck reshuffles and repeats once exhausted, so the admin
// decides when the game ends rather than the deck running out mid-party.
const meta = require('./meta');
const questions = require('./questions');
const {
  broadcastLeaderboard,
  broadcastGameUpdate,
  broadcastTvContent,
  clearTvContent,
} = require('../../broadcast');
const { startTimer } = require('../../timer');

const ANSWER_SECONDS = 45;
const VOTE_SECONDS = 25;
const REVEAL_PAUSE_MS = 6000;
const CORRECT_GUESS_POINTS = 2; // a voter who picks the real answer
const TRICK_POINTS = 1; // per vote a fake answer fooled someone into picking

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

function drawNextQuestion(round) {
  if (round.questionQueue.length === 0) round.questionQueue = shuffle(questions.map((q) => q.id));
  const id = round.questionQueue.shift();
  return questions.find((q) => q.id === id);
}

function start(io, state) {
  if (connectedPlayerIds(state).length === 0) {
    state.activeGame.roundState = null;
    broadcastGameUpdate(io, state, { phase: 'gameOver', noPlayers: true });
    return;
  }

  const roundState = {
    phase: 'pending', // pending -> answer -> vote -> results -> (loop, auto) -> ... until the admin ends the game
    questionQueue: shuffle(questions.map((q) => q.id)),
    currentQuestion: null,
    fakeAnswers: {}, // playerId -> text, reset each question
    shuffledOptions: [], // [{id: 'real' | playerId, text}], reset each question
    votes: {}, // voterPlayerId -> the option id they voted for, reset each question
    timerHandle: null,
    resultsTimeoutId: null,
  };
  roundState.currentQuestion = drawNextQuestion(roundState);
  state.activeGame.roundState = roundState;

  const payload = { phase: 'pending', question: roundState.currentQuestion.question };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
}

function stop(io, state) {
  const round = state.activeGame.roundState;
  if (round) {
    if (round.timerHandle) round.timerHandle.clear();
    if (round.resultsTimeoutId) clearTimeout(round.resultsTimeoutId);
  }
  clearTvContent(io, state);
  state.activeGame.roundState = null;
}

function beginAnswerPhase(io, state) {
  const round = state.activeGame.roundState;
  round.phase = 'answer';
  round.fakeAnswers = {};
  round.votes = {};

  round.timerHandle = startTimer(io, state, {
    seconds: ANSWER_SECONDS,
    label: 'Write a fake answer',
    onComplete: () => closeAnswerPhase(io, state),
  });
  const payload = { phase: 'answer', question: round.currentQuestion.question, timer: round.timerHandle.timer };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
}

function closeAnswerPhase(io, state) {
  const round = state.activeGame.roundState;
  if (round.timerHandle) {
    round.timerHandle.clear();
    round.timerHandle = null;
  }

  const options = [{ id: 'real', text: round.currentQuestion.answer }];
  Object.entries(round.fakeAnswers).forEach(([playerId, text]) => {
    options.push({ id: playerId, text });
  });
  round.shuffledOptions = shuffle(options);
  round.phase = 'vote';

  round.timerHandle = startTimer(io, state, {
    seconds: VOTE_SECONDS,
    label: 'Vote for the real answer',
    onComplete: () => closeVotePhase(io, state),
  });
  const payload = {
    phase: 'vote',
    question: round.currentQuestion.question,
    options: round.shuffledOptions,
    timer: round.timerHandle.timer,
  };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
}

// Not first-past-the-post — every fake answer scores by its own vote count
// independently — so a tie in votes needs no special-casing.
function closeVotePhase(io, state) {
  const round = state.activeGame.roundState;
  if (round.timerHandle) {
    round.timerHandle.clear();
    round.timerHandle = null;
  }

  const voteCounts = {};
  round.shuffledOptions.forEach((o) => { voteCounts[o.id] = 0; });
  Object.values(round.votes).forEach((votedForId) => {
    voteCounts[votedForId] = (voteCounts[votedForId] || 0) + 1;
  });

  Object.entries(round.votes).forEach(([voterId, votedForId]) => {
    if (votedForId === 'real' && state.players[voterId]) {
      state.players[voterId].score += CORRECT_GUESS_POINTS;
    }
  });
  Object.keys(round.fakeAnswers).forEach((authorId) => {
    const tricked = voteCounts[authorId] || 0;
    if (tricked > 0 && state.players[authorId]) state.players[authorId].score += tricked * TRICK_POINTS;
  });

  round.phase = 'results';
  const payload = {
    phase: 'results',
    question: round.currentQuestion.question,
    realAnswer: round.currentQuestion.answer,
    options: round.shuffledOptions.map((o) => ({
      id: o.id,
      text: o.text,
      votes: voteCounts[o.id] || 0,
      authorName: o.id === 'real' ? null : (state.players[o.id] ? state.players[o.id].name : null),
    })),
  };
  broadcastGameUpdate(io, state, payload);
  broadcastTvContent(io, state, payload);
  broadcastLeaderboard(io, state);

  round.resultsTimeoutId = setTimeout(() => {
    round.resultsTimeoutId = null;
    if (round.pendingFinish) {
      const finish = round.pendingFinish;
      round.pendingFinish = null;
      finish();
    } else {
      advanceQuestion(io, state);
    }
  }, REVEAL_PAUSE_MS);
}

// Lets admin:endGame finish the question already in progress instead of
// silently discarding it mid-flight — same pattern as higherLower's
// requestStop, so the outcome depends on the round structure (answer, vote,
// results all play out normally) rather than on how fast the admin happens
// to click. Doesn't force an early resolution: if the round is still being
// answered or voted on, the normal "everyone's in" checks in handleAction
// (or the phase's own timer) resolve it in due course; once results are
// showing, the scheduled callback above picks up pendingFinish once that
// reveal pause ends, instead of drawing another question.
function requestStop(io, state, finish) {
  const round = state.activeGame.roundState;
  if (!round || round.phase === 'pending') {
    finish();
    return;
  }
  round.pendingFinish = finish;
}

function advanceQuestion(io, state) {
  const round = state.activeGame.roundState;
  round.currentQuestion = drawNextQuestion(round);
  beginAnswerPhase(io, state);
}

function handleAdminAction(io, state, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round || payload.type !== 'startTimer') return;
  if (round.phase !== 'pending' || round.timerHandle) return;
  beginAnswerPhase(io, state);
}

function handleAction(io, state, playerId, payload) {
  const round = state.activeGame && state.activeGame.roundState;
  if (!round) return;

  if (typeof payload.fakeAnswer === 'string') {
    if (round.phase !== 'answer' || round.fakeAnswers[playerId]) return;
    const text = payload.fakeAnswer.trim();
    if (!text) return;
    if (text.toLowerCase() === round.currentQuestion.answer.trim().toLowerCase()) return; // can't submit the real answer as your own lie
    round.fakeAnswers[playerId] = text;
    const connectedIds = connectedPlayerIds(state);
    if (connectedIds.every((id) => round.fakeAnswers[id])) closeAnswerPhase(io, state);
    return;
  }

  if (payload.vote) {
    if (round.phase !== 'vote' || round.votes[playerId]) return;
    if (payload.vote === playerId) return; // can't vote for your own fake answer
    const validIds = round.shuffledOptions.map((o) => o.id);
    if (!validIds.includes(payload.vote)) return;
    round.votes[playerId] = payload.vote;
    const connectedIds = connectedPlayerIds(state);
    if (connectedIds.every((id) => round.votes[id])) closeVotePhase(io, state);
  }
}

module.exports = { meta, start, stop, handleAction, handleAdminAction, requestStop };
