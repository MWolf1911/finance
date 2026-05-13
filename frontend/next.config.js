const os = require('os');

function getAllowedDevOrigins() {
  const origins = new Set(['localhost', '127.0.0.1', os.hostname()]);

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses || []) {
      if (address.family === 'IPv4' && !address.internal) {
        origins.add(address.address);
      }
    }
  }

  return Array.from(origins);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: getAllowedDevOrigins(),
};

module.exports = nextConfig;
