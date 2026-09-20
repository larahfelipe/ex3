/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'build',
  env: {
    API_URL: process.env.API_URL
  },
  images: {
    unoptimized: true
  }
};

/**
 * The worker precaches the build output and nothing else. The default rules
 * would keep API responses and rendered pages in the browser cache for a day:
 * they carry the signed-in user's positions, which would survive the session on
 * a shared device and could be replayed as fresh numbers while offline.
 */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production',
  runtimeCaching: [],
  cacheStartUrl: false,
  dynamicStartUrl: false,
  publicExcludes: ['!noprecache/**/*', '!login-hero.jpeg']
});

module.exports = withPWA(nextConfig);
