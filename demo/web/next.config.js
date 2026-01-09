/** @type {import('next').NextConfig} */
const isGhPages = process.env.NEXT_PUBLIC_DEPLOY_TARGET === 'github';
const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const basePath = isGhPages && rawBasePath
  ? (rawBasePath.startsWith('/') ? rawBasePath : `/${rawBasePath}`)
  : '';

const nextConfig = {
  reactStrictMode: true,
  ...(isGhPages && {
    output: 'export',
    trailingSlash: true,
    basePath,
    assetPrefix: basePath || undefined,
    images: { unoptimized: true },
  }),
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
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
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };

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
