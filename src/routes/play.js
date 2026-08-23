const path = require('path');

module.exports = function playRoute(req, res) {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'play.html'));
};
