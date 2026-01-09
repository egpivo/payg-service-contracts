/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow cross-origin requests from 127.0.0.1 in development
  // This prevents the warning when accessing via 127.0.0.1 instead of localhost
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Disable caching in development to prevent stale UI
  ...(process.env.NODE_ENV === 'development' && {
    headers: async () => {
      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'Cache-Control',
              value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
            },
          ],
        },
      ];
    },
  }),
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
