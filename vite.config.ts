import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import playgamaBridge from '@playgama/bridge/vite';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

function playgamaConfigFromEnv(publicToken: string): Plugin {
  const payload = publicToken
    ? JSON.stringify({ saas: { publicToken } }, null, 2) + '\n'
    : '{}\n';

  return {
    name: 'playgama-bridge-env-config',
    configureServer(server) {
      server.middlewares.use('/playgama-bridge-config.json', (_req, res) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(payload);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'playgama-bridge-config.json',
        source: payload,
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), '');
  const playgamaPublicToken = (
    env.VITE_PLAYGAMA_PUBLIC_TOKEN ||
    env.PLAYGAMA_PUBLIC_TOKEN ||
    ''
  ).trim();

  return {
    plugins: [
      playgamaBridge({ mode: 'local' }),
      playgamaConfigFromEnv(playgamaPublicToken),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/three')) return 'vendor-three';
            if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
            if (id.includes('node_modules/react')) return 'vendor-react';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
