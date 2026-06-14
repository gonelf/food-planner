import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, forward /api requests to the local scraper service (server/index.js).
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
