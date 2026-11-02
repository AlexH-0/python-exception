import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const evidence=JSON.parse(readFileSync(resolve('src/data/reliability.json'),'utf8'));

test('chapter 10 shows bounded retries, duplicate effects and partial progress offline',async({page,context},info)=>{
  await context.setOffline(true);await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await mkdir('docs/qa/reliability',{recursive:true});
  const shot=async(name:string)=>{
    await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
    await page.screenshot({path:`docs/qa/reliability/${info.project.name}-${name}.png`,fullPage:true});
  };
  await page.goto(pathToFileURL(resolve('index.html')).href+'#/10');
  await expect(page.locator('.sample-nav button')).toHaveCount(6);
  for(const item of evidence.retries) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    for(const limit of [2,3]) {
      await page.getByRole('button',{name:`最多 ${limit} 次`,exact:true}).click();
      await page.getByRole('button',{name:'查看执行结果',exact:true}).click();
      const retryable=['third-success','always-transient'].includes(item.id);
      const calls=retryable?limit:1;
      await expect(page.locator('.retry-attempt')).toHaveCount(calls);
      await expect(page.locator('.retry-terminal')).toContainText(`实际调用 ${calls} 次 · 等待 ${retryable?limit-1:0} 次`);
      if(item.id==='third-success'&&limit===3) await expect(page.locator('.retry-terminal')).toContainText('结果 42');
      else await expect(page.locator('.retry-terminal')).toContainText(item.id==='permanent'?'PermanentError':item.id==='bug'?'TypeError':'TransientError');
      await expect(page.locator('.retry-attempt').last()).toContainText('本次之后不再等待');
      if(item.id==='third-success'&&limit===2) await shot('retry-exhausted');
      await noOverflow();
    }
  }
  await page.getByRole('button',{name:'重置策略',exact:true}).click();
  await expect(page.locator('.retry-observation')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'最多 2 次',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'02 重复效果',exact:true}).click();
  for(const item of evidence.delivery) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    await expect(page.locator('.delivery-ledger')).toContainText('等待观察');
    const run=page.getByRole('button',{name:'查看接收端留下什么',exact:true});
    await run.focus();await page.keyboard.press('Enter');
    await expect(page.locator('.delivery-ledger li')).toHaveCount(item.id==='stable-key'?1:2);
    await expect(page.locator('.delivery-result')).toContainText('实际调用 2 次');
    await expect(page.locator('.delivery-result')).toContainText(item.id==='stable-key'?'同一请求只追加一次':'留下了重复效果');
    if(item.id==='new-key') await shot('delivery-repeated');
    await noOverflow();
  }
  await page.getByRole('button',{name:'03 部分成功',exact:true}).click();
  for(const item of evidence.partial) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    await expect(page.locator('.partial-step').nth(0)).toContainText('实际写入 1 次');
    await expect(page.locator('.partial-step').nth(1)).toContainText('实际尝试通知 1 次');
    await expect(page.locator('.partial-step').nth(1)).toContainText('通知尚未完成');
    if(item.id==='resume') await shot('partial-first');
    await page.getByRole('button',{name:'尝试结束后',exact:true}).click();
    await expect(page.locator('.partial-step').nth(0)).toContainText(`实际写入 ${item.id==='restart'?2:1} 次`);
    await expect(page.locator('.partial-step').nth(1)).toContainText('实际尝试通知 2 次');
    await expect(page.locator('.partial-step').nth(1)).toContainText(item.id==='still-fails'?'通知尚未完成':'已完成通知');
    if(item.id==='still-fails') await expect(page.locator('.partial-overall')).toContainText('任务仍失败');
    if(item.id==='resume') await shot('partial-resumed');
    await noOverflow();
  }
  await page.getByRole('button',{name:'重置观察时点',exact:true}).click();
  await expect(page.getByRole('button',{name:'首次失败后',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.partial-step').nth(1)).toContainText('实际尝试通知 1 次');
  await page.getByRole('button',{name:'04 自己动手',exact:true}).click();
  await expect(page.locator('.quiz')).toBeVisible();
  await page.getByRole('button',{name:'第 3 题',exact:true}).click();
  await expect(page.locator('.quiz')).toContainText('达到重试上限');
  await page.getByText('本地编程 · 实现有限重试循环',{exact:true}).click();
  await expect(page.getByRole('link',{name:'下载配套项目与测试',exact:true})).toHaveAttribute('href',/^data:application\/zip/);
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await expect(page.locator('.sample-recap-grid>div')).toHaveCount(3);
  const read=page.getByRole('checkbox',{name:'已阅读并回顾本章',exact:true});
  await read.check();await page.reload();
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();await expect(read).toBeChecked();
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  await expect(page.locator('[data-scenario-id="10-retry"]')).toBeVisible();
  await noOverflow();expect(errors).toEqual([]);
});
