/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  distDir: 'build',
  env: {
    API_URL: process.env.API_URL
  },
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;
