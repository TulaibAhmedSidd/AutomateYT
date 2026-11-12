import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  // Next 16 removed `eslint` from next.config (next build no longer lints).
  // Optionally increase timeout for API routes if deploying to Vercel
  experimental: {
    // ...
  }
};

export default nextConfig;
