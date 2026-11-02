import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const projectRoot = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  base: './',
  define: {
    __PYTHON_PACKAGE_URL__: JSON.stringify('data:application/zip;base64,' + readFileSync(resolve(projectRoot, 'public/python-course.zip')).toString('base64')),
  },
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: 'course-development-entry',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url === '/' || request.url?.startsWith('/?')) request.url = '/app.html' + request.url.slice(1);
          next();
        });
      },
    },
  ],
  build: { rollupOptions: { input: resolve(projectRoot, 'app.html') } },
  test: { environment: 'jsdom', include: ['tests/web/**/*.test.{ts,tsx}'], setupFiles: ['tests/web/setup.ts'], restoreMocks: true },
});
