/** @type {import('next').NextConfig} */
const isGhPages = process.env.NEXT_PUBLIC_DEPLOY_TARGET === 'github';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig = {
  reactStrictMode: true,
  // GitHub Pages configuration
  ...(isGhPages && {
    output: 'export',
    trailingSlash: true,
    basePath: basePath,
    assetPrefix: basePath,
    images: {
      unoptimized: true,
    },
  }),
  // Allow cross-origin requests from 127.0.0.1 in development
  // This prevents the warning when accessing via 127.0.0.1 instead of localhost
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  webpack: (config) => {
    // Fallback for Node.js modules that aren't available in browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      // Ignore optional dependencies that aren't needed for browser usage
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };

    // Suppress warnings for optional dependencies (webpack 5)
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules\/@metamask\/sdk/,
      },
      {
        module: /node_modules\/pino/,
      },
      /Can't resolve '@react-native-async-storage\/async-storage'/,
      /Can't resolve 'pino-pretty'/,
    ];

    return config;
  },
};

module.exports = nextConfig;
