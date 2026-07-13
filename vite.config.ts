import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const hmrEnabled = process.env.DISABLE_HMR !== 'true';
  const hmrPort = Number(env.VITE_HMR_PORT || 24679);

  const vendorChunks = [
    {
      name: 'react-vendor',
      packages: ['react', 'react-dom', 'react-router-dom'],
    },
    {
      name: 'query-vendor',
      packages: ['@tanstack/react-query'],
    },
    {
      name: 'ocr-vendor',
      packages: ['tesseract.js'],
    },
    {
      name: 'animation-vendor',
      packages: ['motion'],
    },
  ];

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: hmrEnabled ? { port: hmrPort } : false,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;

            const normalizedId = id.split(path.sep).join('/');
            const matchedChunk = vendorChunks.find(({packages}) =>
              packages.some((packageName) => normalizedId.includes(`/node_modules/${packageName}/`))
            );

            return matchedChunk?.name;
          },
        },
      },
    },
  };
});
