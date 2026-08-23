// The one shared in-memory store for the whole party. No database — this
// object just lives in server memory for as long as the process runs.
const state = {
  // playerId -> { id, name, score, connected, socketId }
  players: {},
  // null, or { gameId, roundState } while a game is running.
  // roundState is fully owned by that game's own module — core code never looks inside it.
  activeGame: null,
  // [{ id, title, description }, ...] — filled in by server.js at startup from src/gameRegistry.js
  gameRegistry: [],
};

module.exports = state;
