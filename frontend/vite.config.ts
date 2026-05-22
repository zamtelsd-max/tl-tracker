import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'favicon.svg'],
      manifest: {
        name: 'TL Tracker – Zamtel Mobile Money',
        short_name: 'TL Tracker',
        description: 'Zamtel Mobile Money Team Lead Productivity Tracker',
        start_url: '/tl-tracker/',
        scope: '/tl-tracker/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#00843D',
        theme_color: '#00843D',
        lang: 'en',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/tl-tracker/icons/icon-72x72.png',   sizes: '72x72',   type: 'image/png', purpose: 'any' },
          { src: '/tl-tracker/icons/icon-96x96.png',   sizes: '96x96',   type: 'image/png', purpose: 'any' },
          { src: '/tl-tracker/icons/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
          { src: '/tl-tracker/icons/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
          { src: '/tl-tracker/icons/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
          { src: '/tl-tracker/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/tl-tracker/icons/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
          { src: '/tl-tracker/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        shortcuts: [
          {
            name: 'My Dashboard',
            short_name: 'Dashboard',
            url: '/tl-tracker/',
            icons: [{ src: '/tl-tracker/icons/icon-96x96.png', sizes: '96x96' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/tl-tracker/index.html',
        navigateFallbackDenylist: [/^\/tl-api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/depcxnwq\.gensparkclaw\.com\/tl-api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
  base: '/tl-tracker/',
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3002', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
