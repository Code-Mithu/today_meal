import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// The `@/...` alias mirrors babel.config.js and tsconfig.json so unit tests can
// import app modules exactly the way the Android bundle does.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
