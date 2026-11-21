import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH lets GitHub Pages serve under /Free-Chart/. Default "/" for Vercel/Cloudflare.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Free Chart',
        short_name: 'Free Chart',
        description: 'Gráficas cripto gratuitas y de código abierto',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      // Only the app shell is cached; market data is never cached by the SW.
      workbox: { globPatterns: ['**/*.{js,css,html,svg}'], navigateFallback: 'index.html' },
    }),
  ],
  build: { target: 'es2022' },
});
