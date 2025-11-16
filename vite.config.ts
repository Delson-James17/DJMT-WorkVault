import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['cookie', 'react-router', 'react-router-dom', 'pdfjs-dist'],
    esbuildOptions: {
      mainFields: ['module', 'main']
    }
  },
  ssr: {
    noExternal: ['cookie', 'react-router', 'react-router-dom']
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'react-vendor';
            }
            if (id.includes('bootstrap')) {
              return 'bootstrap-vendor';
            }
            if (id.includes('supabase')) {
              return 'supabase-vendor';
            }
            if (id.includes('pdfjs-dist')) {
              return 'pdf-vendor';
            }
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1500 // Increased limit
  },
  resolve: {
    mainFields: ['module', 'main']
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});