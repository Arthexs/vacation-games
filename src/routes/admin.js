const path = require('path');

module.exports = function adminRoute(req, res) {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin.html'));
};
