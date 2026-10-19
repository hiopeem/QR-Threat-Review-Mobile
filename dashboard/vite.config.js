import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Allow access through a temporary public tunnel (e.g. *.trycloudflare.com).
    allowedHosts: ['.trycloudflare.com'],
    // Forward API calls to the Express backend so one public URL serves both.
    proxy: {
      '/api':    'http://localhost:3000',
      '/health': 'http://localhost:3000',
    },
  },
});
