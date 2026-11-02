import {defineConfig} from '@playwright/test';
const channel=process.env.COURSE_BROWSER_CHANNEL === 'chromium' ? undefined : (process.env.COURSE_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined));
export default defineConfig({
  testDir:'./tests/e2e',testMatch:'offline.spec.ts',workers:1,timeout:60000,
  use:{headless:true,acceptDownloads:true,screenshot:'only-on-failure',trace:'retain-on-failure'},
  projects:[
    {name:'file-edge',use:{browserName:'chromium',channel,viewport:{width:1440,height:1000}}},
    {name:'file-edge-narrow',use:{browserName:'chromium',channel,viewport:{width:390,height:844}}},
    {name:'file-firefox',use:{browserName:'firefox',viewport:{width:1440,height:1000}}},
  ],
});
