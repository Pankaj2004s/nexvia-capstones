import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the API runs on :5000; the proxy keeps cookies same-origin (httpOnly refresh cookie works).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000', '/socket.io': { target: 'http://localhost:5000', ws: true } } },
  test: { environment: 'node' },
});
