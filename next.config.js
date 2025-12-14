/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    webpack: (config, { isServer }) => {
        // Support for Web Workers
        config.module.rules.push({
            test: /\.worker\.ts$/,
            use: { loader: 'worker-loader' }
        });

        return config;
    },
}

module.exports = nextConfig
