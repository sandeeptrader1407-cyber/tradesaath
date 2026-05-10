import { withSentryConfig } from '@sentry/nextjs';
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "sandeep-a0",

  project: "tradesaath",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
