/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep these packages out of the webpack bundle — let Node require()
    // them at runtime. Required for:
    //  - @napi-rs/canvas:  ships a native .node binary (skia*.node) webpack can't parse
    //  - pdfjs-dist:       uses dynamic imports + node-specific worker loading
    //  - unpdf / tesseract.js: large WASM, previously configured external
    serverComponentsExternalPackages: [
      'unpdf',
      'tesseract.js',
      '@napi-rs/canvas',
      'pdfjs-dist',
      'three',
    ],
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
