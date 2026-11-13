import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Same tenant model as apps/web: the API resolves the dealership from the Host header,
// so open http://dealer-a.localhost:5175 and keep changeOrigin: false.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    allowedHosts: ['.localhost', 'localhost'],
    proxy: { '/api': { target: 'http://127.0.0.1:4000', changeOrigin: false } },
  },
  optimizeDeps: { exclude: ['@huggingface/transformers'] },
  worker: { format: 'es' },
  build: { target: 'es2022' },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as never);
