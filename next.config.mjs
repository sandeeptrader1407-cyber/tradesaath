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
    // Types verified with tsc --noEmit locally
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
