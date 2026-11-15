import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local dev only: forward /api calls to the Express server started by `npm run dev`.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
