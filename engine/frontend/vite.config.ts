import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

// In development the API runs on :8080; Vite forwards /api calls to it.
// `npm run build:static` builds the online demo instead: one self-contained HTML file with the sample data inside,
// no server needed (see src/static/staticApi.ts).
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'static' ? [viteSingleFile()] : [])],
  define: mode === 'static' ? { 'import.meta.env.VITE_STATIC_DEMO': JSON.stringify('1') } : {},
  build: mode === 'static' ? { outDir: 'dist-static' } : {},
  // Only the online demo carries the in-browser engine and its data; the server build gets an empty stub.
  resolve: mode === 'static' ? {} : {
    alias: [{ find: /^\.\/static\/staticApi$/, replacement: fileURLToPath(new URL('./src/static/staticApiStub.ts', import.meta.url)) }],
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:8080' } },
  preview: { port: 4173, proxy: { '/api': 'http://localhost:8080' } },
}));
