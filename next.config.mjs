/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['unpdf', 'tesseract.js'],
  },
  eslint: {
    // Types and lint verified locally — skip during Vercel build to avoid OOM
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Strict TS builds enabled — zero errors as of 2026-04-12
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
