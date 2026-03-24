/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist', 'tesseract.js'],
  },
};

export default nextConfig;
