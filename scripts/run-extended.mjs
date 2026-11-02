import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config=playwright.extended.config.ts',...process.argv.slice(2)],{cwd:root,env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:'0'},stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
