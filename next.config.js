/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    
    // Output statico per GitHub Pages / hosting statico
    // Commenta la riga sotto se vuoi usare Vercel (server-side rendering)
    // Decommentarla per GitHub Pages static export
    output: 'export',
    
    // Configurazione per GitHub Pages
    // Se il repo si chiama "pentagramma", basePath sarà "/pentagramma"
    // Se vuoi pubblicarlo al root, rimuovi basePath
    // basePath: '/pentagramma',  // <-- Personalizza con il nome del tuo repo
    
    // Assicura che le risorse statiche abbiano il percorso corretto
    // assetPrefix: '/pentagramma/',  // <-- Uncomment se usi basePath
    
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
