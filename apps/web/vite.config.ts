import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The API resolves the dealership from the Host header, so the proxy must NOT rewrite it
// (changeOrigin: false). Open http://dealer-a.localhost:5173 or http://dealer-b.localhost:5173.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    allowedHosts: ['.localhost', 'localhost'],
    proxy: { '/api': { target: 'http://127.0.0.1:4000', changeOrigin: false } },
  },
  preview: { port: 4173, allowedHosts: ['.localhost', 'localhost'], proxy: { '/api': { target: 'http://127.0.0.1:4000', changeOrigin: false } } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
          gsap: ['gsap'],
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as never);
