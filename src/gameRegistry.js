// The list the admin's game picker reads: just the public {id, title, description}
// of every registered game, built automatically from src/games/.
const { games } = require('./games');

module.exports = games.map((game) => game.meta);
