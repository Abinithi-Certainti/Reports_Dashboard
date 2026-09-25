// Normal (server) builds use this instead of staticApi.ts, so the bundled demo data - sample and real - never
// ships with the real engine. See vite.config.ts.
export const staticApi = null as unknown as typeof import('./staticApi').staticApi;
