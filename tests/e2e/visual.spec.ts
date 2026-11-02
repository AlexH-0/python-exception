import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {Scenario} from '../../src/content/schema';
const scenes=JSON.parse(readFileSync('src/data/traces.json','utf8')) as Scenario[];
// guided-v2 deliberately preserves the legacy long-page baselines.
// --update-snapshots captures candidates only: visually review and commit before approval.
const baseline=(name:string)=>['guided-v2',name];
test('reviewed visual baselines',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const route of ['home','01','11','12']) {
    await page.goto('/#/'+route);
    await page.evaluate(()=>window.scrollTo(0,0));
    await expect(page).toHaveScreenshot(baseline(route+'-page.png'),{animations:'disabled',maxDiffPixels:0});
  }
  await page.goto('/#/01');
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  await page.getByRole('slider').fill('2');
  await page.getByRole('slider').blur();
  await expect(page.locator('.lab-grid')).toHaveScreenshot(baseline('01-lab-code.png'),{animations:'disabled',maxDiffPixels:0});
  await expect(page.locator('.playback')).toHaveScreenshot(baseline('01-lab-controls.png'),{animations:'disabled',maxDiffPixels:0});
  await page.goto('/#/11');
  const scenario=scenes.find(s=>s.id==='11-group-nested')!;
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  await page.locator('[data-scenario-id="'+scenario.id+'"]').click();
  // A single bound group can contain nested child groups. Do not require
  // two simultaneously bound variables: except* targets are cleared on exit.
  const index=scenario.steps.findIndex(s=>Object.entries(s.state).some(([key,value])=>{
    if(!key.endsWith('.tree'))return false;
    const tree=JSON.parse(value);
    return tree.children?.some((child:{children?:unknown[]})=>child.children?.length);
  }));
  expect(index).toBeGreaterThan(-1);
  await page.getByRole('slider').fill(String(index));
  await page.locator('.exception-trees').scrollIntoViewIfNeeded();
  await expect(page.locator('.exception-trees ul ul ul')).not.toHaveCount(0);
  await expect(page.locator('.exception-trees')).toHaveScreenshot(baseline('11-group-tree.png'),{animations:'disabled',maxDiffPixels:0});
});
