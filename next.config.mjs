/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['unpdf', 'tesseract.js'],
  },
};

export default nextConfig;
