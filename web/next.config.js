const cspHeader = `
default-src 'self';
connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL};
font-src 'self' https://fonts.gstatic.com;
frame-src 'self' ${process.env.NEXT_PUBLIC_API_URL};
img-src 'self' data: *;
script-src 'self' 'unsafe-inline' 'unsafe-eval' ${process.env.NEXT_PUBLIC_API_URL};
style-src 'self' 'unsafe-inline' https://fonts.gstatic.com https://fonts.googleapis.com;
`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: 'build',
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader.replace(/\n/g, '')
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          }
        ]
      }
    ];
  }
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== 'production'
});

module.exports = withPWA(nextConfig);
