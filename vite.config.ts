import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      includeAssets: ['favicon.svg', 'icons/pwa.svg', 'icons/pwa-maskable.svg'],
      manifest: {
        name: 'PumpStock — Filling Station',
        short_name: 'PumpStock',
        description: 'Shifts, fuel stock, credit, ledger, and reports for petrol pump operations.',
        theme_color: '#0d47a1',
        background_color: '#f5f7fa',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/pwa.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: '/favicon.svg',
            sizes: '48x48',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }
          if (id.includes('react-router')) {
            return 'router';
          }
          if (id.includes('@mui') || id.includes('@emotion')) {
            return 'mui';
          }
          if (id.includes('@supabase')) {
            return 'supabase';
          }
          if (id.includes('date-fns')) {
            return 'date-fns';
          }
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('\\react\\')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
})
