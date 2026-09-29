import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// In development the API runs on :8080; Vite forwards /api calls to it.
// Both builds carry the in-browser engine (src/static/staticApi.ts): the app falls back to it when the backend or its
// database cannot be reached (see src/api.ts). `npm run build:static` builds one self-contained HTML file that starts
// in that mode straight away - no server needed.
// Both builds also carry any DEV export in demo/private-data (real figures): dist/ and dist-static/ are git-ignored,
// share them only privately.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'static' ? [viteSingleFile()] : [])],
  define: mode === 'static' ? { 'import.meta.env.VITE_STATIC_DEMO': JSON.stringify('1') } : {},
  build: mode === 'static' ? { outDir: 'dist-static' } : {},
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
  preview: { port: 4173, proxy: { '/api': 'http://localhost:8080' } },
}));
