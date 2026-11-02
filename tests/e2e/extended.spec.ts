import {test,expect,chromium,type Page,type Locator} from '@playwright/test';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {chapters} from '../../src/content/chapters';

async function tabTo(page:Page,target:Locator) {
  for(let i=0;i<100;i++){
    if(await target.evaluate(el=>el===document.activeElement))return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Target was not reachable within 100 Tab presses');
}
async function skipToMain(page:Page) {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'跳转到正文'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
}

test('keyboard chapter links move reading focus to content and permit practice',async({page})=>{
  await page.goto('/#/01');
  await skipToMain(page);
  await tabTo(page,page.getByRole('navigation',{name:'本章导航'}).getByRole('button',{name:'自由实验',exact:true}));
  await page.keyboard.press('Enter');
  await expect(page.locator('.sample-screen-heading h2')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('group',{name:'选择实验场景'}).getByRole('button').first()).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox',{name:/先写下你的预测/})).toBeFocused();
  await page.keyboard.type('predict');
  await tabTo(page,page.getByRole('button',{name:'下一步',exact:true}));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('slider')).toHaveValue('0');

  await page.reload();
  await skipToMain(page);
  await tabTo(page,page.getByRole('navigation',{name:'本章导航'}).getByRole('button',{name:/^\d{2} 自己动手$/}));
  await page.keyboard.press('Enter');
  await expect(page.locator('.sample-screen-heading h2')).toBeFocused();
  const quiz=page.locator('.quiz').first();
  await tabTo(page,quiz.getByRole('radio').first());
  await page.keyboard.press('Space');
  await tabTo(page,quiz.getByRole('button',{name:'检查答案'}));
  await page.keyboard.press('Enter');
  await expect(quiz.getByRole('status')).toContainText(chapters[0].quizzes[0].explanation.replaceAll('`',''));
});

test('accessible event position and controlled live updates',async({page})=>{
  await page.goto('/#/02');
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  const slider=page.getByRole('slider',{name:'事件位置'});
  await expect(slider).toHaveAttribute('aria-valuetext',/尚未开始/);
  await page.getByRole('button',{name:'下一步',exact:true}).click();
  await expect(slider).toHaveAttribute('aria-valuetext',/第 1/);
  await expect(page.locator('.event-card')).toHaveAttribute('aria-live','polite');
  await page.getByRole('button',{name:'播放',exact:true}).click();
  await expect(page.locator('.event-card')).toHaveAttribute('aria-live','off');
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await expect(page.locator('.event-card')).toHaveAttribute('aria-live','polite');
  const tree=await page.locator('#lab').ariaSnapshot();
  expect(tree).toContain('slider "事件位置"');
  expect(tree).toMatch(/button "[^"\n]*正常路径与 else"/);
  expect(tree).toMatch(/button "[^"\n]*子类首先匹配"/);
  await test.info().attach('lab-accessibility-tree',{body:tree,contentType:'text/plain'});
});

test('real browser zoom 200 percent preserves chapters and interactions',async({},testInfo)=>{
  test.skip(testInfo.project.name!=='edge-extended','Uses the installed Edge preference format');
  test.setTimeout(120000);
  const tempBase=resolve('.test-temp');
  const evidence=resolve('docs/qa/extended');
  await mkdir(tempBase,{recursive:true});await mkdir(evidence,{recursive:true});
  const observations:unknown[]=[];
  let normal:{width:number;dpr:number;font:string}|undefined;
  for(const zoom of [1,2]){
    const profile=await mkdtemp(join(tempBase,'zoom-'));
    if(!resolve(profile).startsWith(tempBase+sep))throw new Error('Unsafe temporary profile path');
    await mkdir(join(profile,'Default'));
    // Native browser page zoom, using Chromium's default partition key.
    await writeFile(join(profile,'Default','Preferences'),JSON.stringify({partition:{default_zoom_level:{x:Math.log(zoom)/Math.log(1.2)}}}));
    let context;
    try {
      context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,viewport:null,args:['--window-size=1440,1000'],reducedMotion:'reduce'});
      const page=context.pages()[0];
      const cdp=await context.newCDPSession(page);
      const capture=async(name:string)=>{
        const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});
        await writeFile(join(evidence,name),Buffer.from(shot.data,'base64'));
      };
      await page.goto('http://127.0.0.1:4173/#/01');
      const metrics=await page.evaluate(()=>({width:innerWidth,dpr:devicePixelRatio,font:getComputedStyle(document.querySelector('.sample-screen-heading>p')!).fontSize,visualScale:visualViewport!.scale,outer:outerWidth}));
      observations.push({zoom,...metrics,browser:context.browser()?.version()});
      if(zoom===1){normal=metrics;continue;}
      expect(metrics.dpr/normal!.dpr).toBeCloseTo(2);
      expect(metrics.width/normal!.width).toBeCloseTo(.5,1);
      expect(metrics.font).toBe(normal!.font);
      expect(metrics.visualScale).toBe(1); // not pinch magnification
      for(const route of ['home',...chapters.map(c=>c.id)]){
        await page.goto('http://127.0.0.1:4173/#/'+route);
        await expect(page.getByRole('heading',{level:1})).toBeVisible();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
        if(route!=='home'){
          await page.getByRole('button',{name:'自由实验',exact:true}).click();
          const lab=page.locator('#lab');
          await lab.getByRole('button',{name:'下一步',exact:true}).click();
          await expect(lab.getByRole('slider')).toHaveValue('0');
          await lab.getByRole('button',{name:'重置实验'}).click();
          await page.getByRole('button',{name:/^\d{2} 自己动手$/}).click();
          const quiz=page.locator('.quiz').first();
          await quiz.getByRole('radio').first().check();
          await quiz.getByRole('button',{name:'检查答案'}).click();
          await expect(quiz.getByRole('status')).toBeVisible();
        }
        if(['home','01','11','12'].includes(route)){
          await page.evaluate(()=>window.scrollTo(0,0));
          await capture('zoom200-'+route+'.png');
        }
      }
      await page.goto('http://127.0.0.1:4173/#/01');
      await page.getByRole('button',{name:'自由实验',exact:true}).click();
      await page.locator('.playback').scrollIntoViewIfNeeded();
      await capture('zoom200-controls.png');
      await page.getByRole('button',{name:/^\d{2} 自己动手$/}).click();
      await page.getByText('本地编程 · '+chapters[0].practice.title,{exact:true}).click();
      const code=page.locator('.sample-note .codebox pre').first();
      await code.focus();await page.keyboard.press('ArrowRight');
      await expect.poll(()=>code.evaluate(el=>el.scrollWidth<=el.clientWidth||el.scrollLeft>0)).toBe(true);
    }finally{await context?.close();await rm(profile,{recursive:true,force:true});}
  }
  await writeFile(join(evidence,'zoom-metrics.json'),JSON.stringify(observations,null,2)+'\n');
});
