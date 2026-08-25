const {
  broadcastLeaderboard,
  broadcastActiveGame,
  broadcastPartyStarted,
  broadcastTvContent,
  clearTvContent,
  broadcastCountdown,
  getSnapshot,
} = require('../broadcast');

// GAME_PLANS.md's "Rules display" addition suggested 10-15s — long enough to
// read, short enough not to stall a game that wants /tv sooner (Wits &
// Wagers, Drawful), which just takes it back over once this expires.
const RULES_DISPLAY_MS = 12000;

// A "3...2...1" beat before an admin-triggered timer actually starts, so
// players get a moment to look up/get ready instead of the clock just
// silently already running. Handled once here rather than per-game, same
// reasoning as the rules banner above — every game's "Start Timer" admin
// action already funnels through this one handler. Deliberately does NOT
// wrap src/timer.js's startTimer() itself: a few games (Drawful's title/vote
// phases) auto-chain a new timer directly from a previous phase's
// onComplete, with no admin click and no "get ready" moment to insert —
// scoping this to admin:action instead excludes those for free.
const PRE_TIMER_COUNTDOWN_SECONDS = 3;

function runPreTimerCountdown(io, state, gameId, onComplete) {
  let secondsLeft = PRE_TIMER_COUNTDOWN_SECONDS;
  broadcastCountdown(io, state, secondsLeft);
  const tick = () => {
    if (!state.activeGame || state.activeGame.gameId !== gameId) {
      broadcastCountdown(io, state, null); // game ended/changed mid-countdown — don't leave the overlay stuck
      return;
    }
    secondsLeft -= 1;
    if (secondsLeft > 0) {
      broadcastCountdown(io, state, secondsLeft);
      setTimeout(tick, 1000);
      return;
    }
    broadcastCountdown(io, state, null);
    onComplete();
  };
  setTimeout(tick, 1000);
}

// Registered once per connected socket (see server.js). Access control is just
// the /admin URL being unshared — there's no auth check on these events.
module.exports = function registerAdminSocket(io, socket, state, gamesById) {
  socket.on('admin:join', () => {
    socket.join('admin');
    socket.emit('state:snapshot', getSnapshot(state));
  });

  socket.on('admin:startParty', () => {
    if (state.partyStarted) return;
    state.partyStarted = true;
    broadcastPartyStarted(io, state);
  });

  socket.on('admin:selectGame', ({ gameId } = {}) => {
    if (state.activeGame) return; // one game at a time — end the current one first
    const game = gamesById[gameId];
    if (!game) return;

    state.activeGame = { gameId, roundState: null, title: game.meta.title, rules: game.meta.rules || [] };
    game.start(io, state);
    broadcastActiveGame(io, state);

    // Briefly override /tv with the rules before handing control back to
    // whatever the game shows next — its own tv:content (Drawful, Psych!
    // may have already pushed something in start(), captured below and
    // restored), or the leaderboard for a game that hasn't pushed anything
    // yet (Spyfall/Imposter/Heads Up! wait on the admin to pick a role
    // first). Reference equality on rulesPayload is how the timeout below
    // tells "nothing has changed since" apart from "the game already
    // pushed newer content, don't stomp on it."
    const preRulesTvContent = state.activeGame.tvContent || null;
    const rulesPayload = { type: 'rules', title: game.meta.title, rules: game.meta.rules || [] };
    broadcastTvContent(io, state, rulesPayload);
    setTimeout(() => {
      if (!state.activeGame || state.activeGame.gameId !== gameId) return; // game ended/changed since
      if (state.activeGame.tvContent !== rulesPayload) return; // game already pushed something newer
      if (preRulesTvContent) {
        broadcastTvContent(io, state, preRulesTvContent);
      } else {
        clearTvContent(io, state);
      }
    }, RULES_DISPLAY_MS);
  });

  socket.on('admin:endGame', () => {
    if (!state.activeGame) return;
    const game = gamesById[state.activeGame.gameId];

    const finishEndGame = () => {
      game.stop(io, state);
      state.activeGame = null;
      broadcastActiveGame(io, state);
      broadcastLeaderboard(io, state);
    };

    // Optional: a game with a "some players answered, some haven't" round
    // (e.g. higherLower) can hold off on finishEndGame until that round
    // resolves naturally, instead of the round just getting silently
    // discarded mid-flight. A game without requestStop ends immediately,
    // exactly as before.
    if (game.requestStop) {
      game.requestStop(io, state, finishEndGame);
    } else {
      finishEndGame();
    }
  });

  // Manual override — e.g. restoring a score after a player's phone/app crashed
  // mid-game. Sets the score directly rather than adding/subtracting.
  socket.on('admin:setScore', ({ playerId, score } = {}) => {
    const player = state.players[playerId];
    if (!player || !Number.isFinite(score)) return;
    player.score = score;
    broadcastLeaderboard(io, state);
  });

  // Mirrors player:action -> handleAction: a way to steer a round already in
  // progress (assign a secret role, start a discussion timer) rather than
  // just starting/stopping the whole game. Optional — a game only exports
  // handleAdminAction if it needs an admin-in-the-loop step.
  socket.on('admin:action', (payload) => {
    if (!state.activeGame) return;
    const gameId = state.activeGame.gameId;
    const game = gamesById[gameId];
    if (!game.handleAdminAction) return;

    // Every game's "Start Timer" button funnels through here with the same
    // { type: 'startTimer' } shape, so the pre-timer countdown (see above)
    // is inserted once, generically, instead of per game.
    if (payload.type === 'startTimer') {
      runPreTimerCountdown(io, state, gameId, () => {
        if (!state.activeGame || state.activeGame.gameId !== gameId) return; // game ended/changed mid-countdown
        game.handleAdminAction(io, state, payload);
      });
      return;
    }

    game.handleAdminAction(io, state, payload);
  });
};
