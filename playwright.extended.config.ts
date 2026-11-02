import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'./tests/e2e',testMatch:['extended.spec.ts','course.spec.ts','sample.spec.ts'],
  fullyParallel:false,workers:1,timeout:60000,
  use:{baseURL:'http://127.0.0.1:4173',headless:true,screenshot:'only-on-failure',trace:'retain-on-failure'},
  projects:[
    {name:'edge-extended',testMatch:'extended.spec.ts',use:{browserName:'chromium',channel:'msedge',viewport:{width:1440,height:1000}}},
    {name:'firefox-desktop',grepInvert:/real browser zoom/,use:{browserName:'firefox',viewport:{width:1440,height:1000}}},
    {name:'firefox-narrow',testMatch:['course.spec.ts','sample.spec.ts'],use:{browserName:'firefox',viewport:{width:390,height:844}}},
  ],
  webServer:{command:'node scripts/serve.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
});
