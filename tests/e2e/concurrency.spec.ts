import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const evidence=JSON.parse(readFileSync(resolve('src/data/concurrency.json'),'utf8'));

test('chapter 11 preserves group branches, cancellation modes and cleanup outcomes offline',async({page,context},info)=>{
  await context.setOffline(true);await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await mkdir('docs/qa/concurrency',{recursive:true});
  const shot=async(name:string)=>{
    await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
    await page.screenshot({path:`docs/qa/concurrency/${info.project.name}-${name}.png`,fullPage:true});
  };
  await page.goto(pathToFileURL(resolve('index.html')).href+'#/11');
  await expect(page.locator('.sample-nav button')).toHaveCount(8);
  for(const type of ['ValueError','TypeError','Exception']) {
    await page.getByRole('button',{name:type,exact:true}).click();
    await page.getByRole('button',{name:'匹配部分',exact:true}).click();
    await expect(page.locator('.concurrent-result-tree .concurrent-leaf')).toHaveCount(type==='Exception'?3:1);
    await page.getByRole('button',{name:'剩余部分',exact:true}).click();
    await expect(page.locator('.concurrent-result-tree .concurrent-leaf')).toHaveCount(type==='Exception'?0:2);
    await expect(page.locator('.concurrent-split>.concurrent-tree .concurrent-leaf')).toHaveCount(3);
    if(type==='Exception') await expect(page.locator('.concurrent-result-tree')).toContainText('None');
    await noOverflow();
  }
  await page.getByRole('button',{name:'ValueError',exact:true}).click();
  await page.getByRole('button',{name:'匹配部分',exact:true}).click();
  await shot('nested-split');
  await page.getByRole('button',{name:'02 except*',exact:true}).click();
  for(const item of evidence.routes) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    await expect(page.locator('.star-handled h3')).toHaveCount(item.id==='ordinary'?0:item.id==='residual'?1:2);
    await expect(page.locator('.star-remainder .concurrent-leaf')).toHaveCount(item.id==='ordinary'?2:item.id==='all'?0:1);
    if(item.id==='nested') await expect(page.locator('.star-handled')).toContainText('inner');
    await noOverflow();
  }
  await page.getByRole('button',{name:'03 取消信号',exact:true}).click();
  const next=page.getByRole('button',{name:'下一个取消事件',exact:true});
  await next.click();await next.click();
  await expect(page.locator('.cancel-stop-seen')).toHaveCount(2);
  await page.getByText('试试错误写法：捕获取消后返回成功值',{exact:true}).click();
  const toggle=page.getByRole('checkbox',{name:'进入错误副本：吞掉 CancelledError',exact:true});
  await toggle.focus();await page.keyboard.press('Space');
  await expect(page.locator('.cancel-counterexample')).toBeVisible();
  await expect(page.locator('.cancel-stop-seen')).toHaveCount(0);
  await next.click();await next.click();await next.click();
  await toggle.uncheck();
  await expect(page.locator('.cancel-stop-seen')).toHaveCount(2);
  await next.click();await next.click();
  await expect(page.locator('.cancel-outcome')).toContainText('task.cancelled() = True');
  await expect(page.locator('.cancel-outcome')).toContainText('取消继续传播');
  await toggle.check();
  await expect(page.locator('.cancel-stop-seen')).toHaveCount(3);
  await next.click();await next.click();
  await expect(page.locator('.cancel-outcome')).toContainText('task.cancelled() = False');
  await expect(page.locator('.cancel-outcome')).toContainText('pretend success');
  await shot('cancel-counter');await noOverflow();
  await page.getByRole('button',{name:'上一个取消事件',exact:true}).click();
  await expect(next).toBeEnabled();
  await page.getByRole('button',{name:'重置两份取消实验',exact:true}).click();
  await expect(toggle).not.toBeChecked();await expect(page.locator('.cancel-stop-seen')).toHaveCount(0);
  await toggle.check();await expect(page.locator('.cancel-stop-seen')).toHaveCount(0);
  await page.getByRole('button',{name:'04 TaskGroup',exact:true}).click();
  for(const item of evidence.taskgroups) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    for(let i=0;i<4;i++) await page.locator('.taskgroup-milestones button').nth(i).click();
    await expect(page.locator('.taskgroup-result .concurrent-leaf')).toHaveCount(item.id==='clean'?1:2);
    await expect(page.locator('.taskgroup-result')).toContainText('done = True');
    await expect(page.locator('.taskgroup-result')).toContainText(item.id==='clean'?'cancelled = True':'cancelled = False');
    if(item.id==='cleanup-error') {await expect(page.locator('.taskgroup-result')).toContainText('RuntimeError');await shot('taskgroup-cleanup');}
    await page.getByRole('button',{name:'上一个组退出节点',exact:true}).click();
    await expect(page.locator('.taskgroup-result .concurrent-tree')).toHaveCount(0);
    await page.getByRole('button',{name:'重置组退出过程',exact:true}).click();
    await expect(page.locator('.taskgroup-gate')).toContainText('尚未开始');await noOverflow();
  }
  await page.getByRole('button',{name:'05 生成器关闭',exact:true}).click();
  for(const item of evidence.generators) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    await expect(page.locator('.generator-boundary dl')).toHaveCount(0);
    await page.getByRole('button',{name:'观察生成器怎样结束',exact:true}).click();
    await expect(page.locator('.generator-boundary>div>strong').nth(1)).toHaveText(item.id==='return'?'StopIteration':item.id==='stop'?'RuntimeError':'close() 正常返回');
    await expect(page.locator('.generator-boundary dl')).toContainText('已执行');
    if(item.id==='return') await expect(page.locator('.generator-boundary dd').nth(0)).toHaveText('9');
    if(item.id==='stop') {await expect(page.locator('.generator-boundary dd').nth(1)).toHaveText('StopIteration');await shot('generator-boundary');}
    await noOverflow();
  }
  await page.getByRole('button',{name:'06 自己动手',exact:true}).click();
  await expect(page.locator('.quiz')).toBeVisible();
  await page.getByRole('button',{name:'第 3 题',exact:true}).click();await expect(page.locator('.quiz')).toContainText('CancelledError');
  await page.getByText('本地编程 · 拆分异常组并保留剩余部分',{exact:true}).click();
  await expect(page.getByRole('link',{name:'下载配套项目与测试',exact:true})).toHaveAttribute('href',/^data:application\/zip/);
  await page.getByRole('button',{name:'07 回顾',exact:true}).click();
  await expect(page.locator('.sample-recap-grid>div')).toHaveCount(3);
  const read=page.getByRole('checkbox',{name:'已阅读并回顾本章',exact:true});await read.check();await page.reload();
  await page.getByRole('button',{name:'07 回顾',exact:true}).click();await expect(read).toBeChecked();
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  for(const id of ['11-group','11-group-residual','11-group-nested','11-cancel','11-taskgroup','11-generator']) await expect(page.locator(`[data-scenario-id="${id}"]`)).toBeVisible();
  await noOverflow();expect(errors).toEqual([]);
});
