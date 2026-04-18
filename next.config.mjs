/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['unpdf', 'tesseract.js'],
  },
  eslint: {
    // ESLint runs during builds — all rules enforced
    ignoreDuringBuilds: false,
  },
  typescript: {
    // Strict TS builds enabled — zero errors as of 2026-04-12
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
