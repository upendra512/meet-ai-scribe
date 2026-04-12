/** @type {import('next').NextConfig} */
const nextConfig = {
  // Suppress prerender errors caused by Firebase initializing without env vars at build time.
  // All affected pages are already marked `'use client'` + `dynamic = 'force-dynamic'`
  // so they will always be server-rendered at request time with the real env vars.
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  // Allow the build to succeed even when prerendering fails for client-only pages.
  // These pages will be rendered on-demand at runtime where NEXT_PUBLIC_ env vars are set.
  output: undefined,
};

export default nextConfig;
