import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const buildId = process.env.LM_BUILD_ID || 'dev';
const buildTime = process.env.LM_BUILD_TIME || new Date().toISOString();

export default defineConfig({
  plugins: [react()],
  define: {
    __LM_BUILD_ID__: JSON.stringify(buildId),
    __LM_BUILD_TIME__: JSON.stringify(buildTime),
  },
  server: { proxy: { '/api': 'http://localhost:8000', '/ws': { target: 'ws://localhost:8000', ws: true } } },
});
