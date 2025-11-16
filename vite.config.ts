import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'cookie', 'pdfjs-dist', '@supabase/supabase-js'],
    esbuildOptions: { mainFields: ['module', 'main'] }
  },
  ssr: {
    noExternal: ['@supabase/supabase-js', 'cookie', 'react-router-dom']
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
            if (id.includes('supabase')) return 'supabase-vendor';
            if (id.includes('pdfjs-dist')) return 'pdf-vendor';
            if (id.includes('bootstrap')) return 'bootstrap-vendor';
            if (id.includes('react') || id.includes('react-dom')) return 'vendor';
            return 'vendor';
          }
        }
      }
    },
    chunkSizeWarningLimit: 1500
  },
  resolve: { dedupe: ['react', 'react-dom'], mainFields: ['module', 'main'] },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});
