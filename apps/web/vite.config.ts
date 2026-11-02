import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // GitHub Codespaces serves forwarded ports from *.app.github.dev
    allowedHosts: ['.app.github.dev'],
    proxy: { '/api': 'http://localhost:3000' },
  },
});
