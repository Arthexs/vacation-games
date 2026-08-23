const path = require('path');

module.exports = function tvRoute(req, res) {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'tv.html'));
};
