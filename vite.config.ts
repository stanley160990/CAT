import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import express from 'express';
import apiRouter from './src/server/routes.ts';
import { checkAndAutoInitIfEmpty } from './src/server/seed.ts';

function apiPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    configureServer(server) {
      const app = express();
      app.use(express.json({ limit: '15mb' }));
      app.use(express.urlencoded({ extended: true, limit: '15mb' }));
      app.use('/api', apiRouter);

      // Check and seed initial data if database is empty
      checkAndAutoInitIfEmpty(false).catch((err) => {
        console.error('Initial auto-seed check warning:', err?.message || err);
      });

      server.middlewares.use(app);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
