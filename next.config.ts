import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  // Optionally increase timeout for API routes if deploying to Vercel
  experimental: {
    // ...
  }
};

export default nextConfig;
