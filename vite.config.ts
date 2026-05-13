import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
          if (id.includes('firebase')) {
            return 'firebase';
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
