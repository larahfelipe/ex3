/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'build',
  experimental: {
    typedRoutes: true
  }
};

module.exports = nextConfig;
