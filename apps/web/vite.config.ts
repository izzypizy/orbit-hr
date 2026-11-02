import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const shim = (file: string) => fileURLToPath(new URL(`./src/demo/shims/${file}`, import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // `--mode demo` builds a static site for GitHub Pages: the API runs in the browser (src/demo/server.ts)
  ...(mode === 'demo' && {
    base: process.env.DEMO_BASE ?? '/orbit-hr/',
    resolve: {
      alias: {
        '@nestjs/common': shim('nest-common.ts'),
        '@nestjs/core': shim('nest-core.ts'),
        '@nestjs/jwt': shim('nest-jwt.ts'),
        '@nestjs/platform-express': shim('upload.ts'),
        multer: shim('upload.ts'),
      },
    },
  }),
  server: {
    port: 5173,
    // GitHub Codespaces serves forwarded ports from *.app.github.dev
    allowedHosts: ['.app.github.dev'],
    proxy: { '/api': 'http://localhost:3000' },
  },
}));
