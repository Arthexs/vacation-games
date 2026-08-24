// One authoritative countdown a game can start — never automatically, only in
// response to an admin action (see GAME_PLANS.md's admin-triggered-timer rule).
// The server's own setTimeout is what actually ends the round, so a phone tab
// going to sleep/drifting can't stall it; the {startedAt, durationMs} payload
// just lets clients count down locally instead of the server ticking every
// second over the socket. This only owns the /tv countdown banner and the
// authoritative timeout — a game merges `timer` into its own player-facing
// update itself (via broadcastGameUpdate/sendPlayerUpdate), since only the
// game knows what else belongs in that payload.
const { broadcastTvTimer, clearTvTimer } = require('./broadcast');

function startTimer(io, state, { seconds, label, onComplete }) {
  const timer = { startedAt: Date.now(), durationMs: seconds * 1000, label };
  broadcastTvTimer(io, state, timer);

  const timeoutId = setTimeout(() => {
    clearTvTimer(io, state);
    onComplete();
  }, seconds * 1000);

  return {
    timer,
    // For a game's stop() (or an early phase change) to cancel a still-running
    // timer without firing onComplete.
    clear() {
      clearTimeout(timeoutId);
      clearTvTimer(io, state);
    },
  };
}

module.exports = { startTimer };
