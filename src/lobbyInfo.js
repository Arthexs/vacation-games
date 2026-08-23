// Computed once at startup and handed to the tv socket handler — the LAN IP
// doesn't change mid-party, so there's no reason to recompute this per connection.
const os = require('os');
const qrcode = require('qrcode');

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const interfaces of Object.values(nets)) {
    for (const net of interfaces) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

async function buildLobbyInfo(port) {
  const joinUrl = `http://${getLocalIp()}:${port}/play`;
  // The tv lobby stretches this image to fill however much of the screen is
  // available (which can be a large TV), so render it well above typical
  // display size up front rather than letting the browser upscale a small PNG.
  const qrDataUrl = await qrcode.toDataURL(joinUrl, { width: 1000 });
  return { joinUrl, qrDataUrl };
}

module.exports = { getLocalIp, buildLobbyInfo };