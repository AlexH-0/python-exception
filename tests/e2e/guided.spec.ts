import {test,expect} from '@playwright/test';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import type {Scenario} from '../../src/content/schema';
const traces=JSON.parse(readFileSync('src/data/traces.json','utf8')) as Scenario[];

test('guided finally lesson works offline: results, loops, failure and practice',async({page,context},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await context.setOffline(true);
  await page.goto(pathToFileURL(resolve('index.html')).href+'#/03');
  await mkdir('docs/qa/mechanisms',{recursive:true});
  for(const [mode,label,result] of [['keep','只做清理','4'],['replace','改成 return 9','9'],['fail','清理时抛错','OSError']]){
    await page.getByRole('button',{name:label,exact:true}).click();
    await expect(page.getByLabel('当前输出')).toHaveText('（尚无输出）');
    await page.getByRole('button',{name:'执行清理',exact:true}).click();
    await expect(page.getByLabel('当前输出')).toHaveText('cleanup');
    await page.getByRole('button',{name:'交付结果',exact:true}).click();
    await expect(page.locator('.received strong')).toHaveText(result);
    await expect(page.getByLabel('当前输出')).toHaveText(traces.find(s=>s.id==='03-result-'+mode)!.output.join('\n'));
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.sample-stage').screenshot({path:`docs/qa/mechanisms/${info.project.name}-03-return.png`});
  await page.getByRole('button',{name:'02 循环出口',exact:true}).click();
  for(const mode of ['normal','break','continue']){
    await page.getByRole('button',{name:mode==='normal'?'正常走完':mode,exact:true}).click();
    await expect(page.getByLabel('本次运行输出')).toHaveText(traces.find(s=>s.id==='03-finally-'+mode)!.output.join('\n'));
    await expect(page.locator('.lane-done')).toHaveCount(mode==='normal'?6:mode==='break'?2:4);
  }
  await page.locator('.sample-stage').screenshot({path:`docs/qa/mechanisms/${info.project.name}-03-loop.png`});
  await page.getByRole('button',{name:'03 异常覆盖',exact:true}).click();
  await page.getByRole('button',{name:/清理又抛异常/}).click();
  await expect(page.locator('.outcome-strip')).toContainText('RuntimeError: cleanup failed');
  await page.getByRole('button',{name:/清理里写 return/}).click();
  await expect(page.locator('.outcome-strip')).toContainText('overridden');
  await page.getByRole('button',{name:'04 自己动手',exact:true}).click();
  await page.getByRole('radio',{name:'4',exact:true}).check();
  await page.getByRole('button',{name:'检查答案',exact:true}).click();
  await expect(page.locator('.quiz [role=status]')).toContainText('再检查');
  await page.getByRole('button',{name:'下一节 →',exact:true}).click();
  await page.getByLabel('已阅读并回顾本章').check();
  await page.reload();
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await expect(page.getByLabel('已阅读并回顾本章')).toBeChecked();
  expect(errors).toEqual([]);
});

test('guided propagation lesson works offline: unwind, traceback and recovery boundary',async({page,context},info)=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await context.setOffline(true);
  await page.goto(pathToFileURL(resolve('index.html')).href+'#/04');
  await mkdir('docs/qa/mechanisms',{recursive:true});
  const scene=traces.find(s=>s.id==='04-stack')!;
  const expected=['leaf starts','leaf starts\nleaf cleanup','leaf starts\nleaf cleanup','leaf starts\nleaf cleanup\nmiddle cleanup','leaf starts\nleaf cleanup\nmiddle cleanup',scene.output.join('\n')];
  for(let i=0;i<6;i++){
    await expect(page.getByLabel('栈展开输出')).toHaveText(expected[i]);
    await expect(page.locator('.frame-exited')).toHaveCount(i>=4?2:i>=2?1:0);
    if(i<5) await page.getByRole('button',{name:'继续观察',exact:true}).click();
  }
  await expect(page.locator('.orb-caught')).toContainText('已处理');
  await page.getByRole('button',{name:'重新展开',exact:true}).click();
  await page.getByRole('button',{name:'继续观察',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('栈展开输出')).toHaveText(expected[1]);
  await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`docs/qa/mechanisms/${info.project.name}-04-stack.png`,fullPage:true});
  await page.getByRole('button',{name:'02 读 traceback',exact:true}).click();
  await page.locator('.traceback-reader>button').nth(0).click();
  await expect(page.locator('.traceback-explanation')).toContainText('不说明入口本身一定写错');
  await page.locator('.traceback-reader>button').nth(2).click();
  await expect(page.locator('.traceback-explanation')).toContainText('失败的直接操作');
  await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
  await page.screenshot({path:`docs/qa/mechanisms/${info.project.name}-04-traceback.png`,fullPage:true});
  await page.getByRole('button',{name:'03 捕获位置',exact:true}).click();
  await page.locator('.boundary-layers>button').nth(2).click();
  await expect(page.locator('.traceback-explanation')).toContainText('记录失败并继续下一条');
  await page.getByRole('button',{name:'04 自己动手',exact:true}).click();
  await page.getByRole('radio').first().check();
  await page.getByRole('button',{name:'检查答案',exact:true}).click();
  await expect(page.locator('.quiz [role=status]')).toContainText('判断正确');
  expect(errors).toEqual([]);
});
