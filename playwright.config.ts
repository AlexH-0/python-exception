import { defineConfig } from '@playwright/test';
const channel=process.env.COURSE_BROWSER_CHANNEL === 'chromium' ? undefined : (process.env.COURSE_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined));
export default defineConfig({
  testDir: './tests/e2e', testIgnore: ['extended.spec.ts', 'offline.spec.ts', ...(process.env.COURSE_VISUAL ? [] : ['visual.spec.ts'])], fullyParallel: false, workers: 1, timeout: 60000,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true, channel, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name:'desktop',use:{ viewport:{width:1440,height:1000} } },
    { name:'mobile',use:{ viewport:{width:390,height:844},isMobile:true,hasTouch:true } },
  ],
  webServer: { command:'npm run preview -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI },
});
