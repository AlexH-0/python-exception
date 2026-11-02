import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const evidence=JSON.parse(readFileSync(resolve('src/data/project.json'),'utf8'));

test('chapter 12 uses real project boundaries and ends at the learning route offline',async({page,context},info)=>{
  await context.setOffline(true);await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await mkdir('docs/qa/project',{recursive:true});
  const shot=async(name:string)=>{
    await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
    await page.screenshot({path:`docs/qa/project/${info.project.name}-${name}.png`,fullPage:true});
  };
  const url=pathToFileURL(resolve('index.html')).href;
  await page.goto(url+'#/11');
  await page.getByRole('button',{name:'07 回顾',exact:true}).click();
  await page.locator('.sample-footer').getByRole('link',{name:'下一章 →',exact:true}).click();
  await expect(page).toHaveURL(/#\/12$/);
  await expect(page.locator('.sample-nav button')).toHaveCount(7);
  for(const item of evidence.entry) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    const run=page.getByRole('button',{name:'查看项目的实际结果',exact:true});
    await run.focus();await page.keyboard.press('Enter');
    await expect(page.locator('.project-calls li')).toHaveCount(item.id==='valid'?2:0);
    await expect(page.locator('.project-entry')).toContainText(item.id==='valid'?'整批校验通过':'一次也没调用');
    if(item.id==='bad-json') await expect(page.locator('.project-entry-observation')).toContainText('JSONDecodeError');
    if(item.id==='invalid-row') {await expect(page.locator('.project-entry-observation')).toContainText('task index: 1');await shot('entry-rejected');}
    await noOverflow();
  }
  await page.getByRole('button',{name:'02 执行隔离',exact:true}).click();
  for(const item of evidence.batches) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    await page.getByRole('button',{name:'查看批次如何继续',exact:true}).click();
    await expect(page.locator('.project-task')).toHaveCount(3);
    await expect(page.locator('.project-calls li')).toHaveCount(item.id==='exhausted'?4:item.id==='bug'?2:3);
    if(item.id==='bug') {
      await expect(page.locator('.project-results')).toHaveCount(0);
      await expect(page.locator('.project-interrupted')).toContainText('没有返回 Result 列表');
      await expect(page.locator('.project-task').nth(2)).toContainText('未执行');
      await expect(page.locator('.project-committed dt')).toHaveText(['a']);
      await expect(page.locator('.project-committed dd')).toHaveText(['4']);
      await shot('batch-interrupted');
    } else {
      await expect(page.locator('.project-results tbody tr')).toHaveCount(3);
      await expect(page.locator('.project-status')).toHaveText(['done','failed','done']);
    }
    await noOverflow();
  }
  await page.getByRole('button',{name:'03 缓存与结果',exact:true}).click();
  for(const item of evidence.cache) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    await page.getByRole('button',{name:'查看调用与成功缓存',exact:true}).click();
    await expect(page.locator('.project-calls li')).toHaveCount(item.id==='same'?1:2);
    await expect(page.locator('.project-status')).toHaveText(item.id==='same'?['done','cached']:item.id==='conflict'?['done','failed','done']:['done','done']);
    if(item.id==='conflict') {await expect(page.locator('.project-committed dd')).toHaveText(['4','6']);await shot('cache-conflict');}
    await noOverflow();
  }
  await page.getByRole('button',{name:'04 本地交付',exact:true}).click();
  await expect(page.getByRole('link',{name:'下载完整配套项目',exact:true})).toHaveAttribute('href',/^data:application\/zip/);
  for(const item of evidence.cli) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    await expect(page.locator('.project-cli-title')).toContainText(item.id==='valid'?'退出码 0':'退出码 2');
    if(item.id==='valid') await expect(page.locator('.project-cli-observation')).toContainText('cached');
    else {await expect(page.locator('.project-cli-observation')).toContainText('invalid task JSON');await expect(page.getByLabel('终端 · 在项目根目录运行',{exact:true})).toContainText('broken_tasks.sample.txt');await shot('local-cli');}
    await noOverflow();
  }
  await page.getByRole('button',{name:'05 自己动手',exact:true}).click();
  await expect(page.locator('.quiz')).toBeVisible();
  await page.getByRole('button',{name:'第 3 题',exact:true}).click();await expect(page.locator('.quiz')).toContainText('status');
  await page.getByText('本地编程 · 实现幂等批次处理',{exact:true}).click();
  await expect(page.getByRole('link',{name:'下载配套项目与测试',exact:true})).toHaveAttribute('href',/^data:application\/zip/);
  await page.getByRole('button',{name:'06 回顾',exact:true}).click();
  const read=page.getByRole('checkbox',{name:'已阅读并回顾本章',exact:true});await read.check();await page.reload();
  await page.getByRole('button',{name:'06 回顾',exact:true}).click();await expect(read).toBeChecked();
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  await expect(page.locator('[data-scenario-id="12-project"]')).toBeVisible();await noOverflow();
  await page.locator('.sample-footer').getByRole('link',{name:'返回学习路线 →',exact:true}).click();
  await expect(page).toHaveURL(/#\/home$/);expect(errors).toEqual([]);
});
