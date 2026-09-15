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

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production'
});

module.exports = withPWA(nextConfig);
