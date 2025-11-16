import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1600, // or 2000
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787', // your Express server
        changeOrigin: true,
      },
    },
  },
})
