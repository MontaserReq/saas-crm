const spreadsheetRuntimeFiles = [
  './src/lib/imports/xlsxParserWorker.cjs',
  './node_modules/read-excel-file/**/*',
  './node_modules/fflate/**/*',
  './node_modules/saxen/**/*',
  './node_modules/unzipper-esm/**/*',
  './node_modules/graceful-fs/**/*',
  './node_modules/node-int64/**/*',
  './node_modules/worker-f/**/*',
  './node_modules/papaparse/**/*',
  './scripts/standalone-xlsx-smoke.cjs',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Visual QA can run independently of the standard production/dev cache.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,

  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  outputFileTracingIncludes: {
    '/api/imports/analyze': spreadsheetRuntimeFiles,
    '/api/schools/import': spreadsheetRuntimeFiles,
  },

  experimental: { 
    serverActions: {
      // The shared attachment policy permits 25 MB aggregate plus form overhead.
      bodySizeLimit: "30mb",
    },
  },
};

export default nextConfig;
