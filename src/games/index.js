// Registers every game module. Adding a new game later means adding one line
// here (and a matching folder under public/games/) — no other core file changes.
const demoGame = require('./demoGame/server');
const higherLower = require('./higherLower/server');
const spyfall = require('./spyfall/server');
const imposter = require('./imposter/server');

const games = [demoGame, higherLower, spyfall, imposter];
const gamesById = Object.fromEntries(games.map((game) => [game.meta.id, game]));

module.exports = { games, gamesById };
