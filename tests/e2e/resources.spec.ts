import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

test('chapter 08 follows real resource boundaries offline', async ({page,context},info)=>{
  await context.setOffline(true);
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await mkdir('docs/qa/resources',{recursive:true});
  const shot=async(name:string)=>{
    await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
    await page.screenshot({path:`docs/qa/resources/${info.project.name}-${name}.png`,fullPage:true});
  };
  await page.goto(pathToFileURL(resolve('index.html')).href+'#/08');
  await expect(page.locator('.sample-nav button')).toHaveCount(6);
  await page.getByRole('button',{name:'查看本次路径',exact:true}).click();
  await expect(page.locator('.resource-gate-card').nth(1)).toContainText('未进入');
  await expect(page.locator('.resource-gate-card').nth(2)).toContainText('未调用');
  await expect(page.locator('.resource-output')).toContainText('outer caught OSError');
  await shot('enter-failure'); await noOverflow();
  await page.getByRole('button',{name:'进入成功',exact:true}).click();
  await expect(page.locator('.resource-gate')).toContainText('等待观察');
  await page.getByRole('button',{name:'查看本次路径',exact:true}).click();
  await expect(page.locator('.resource-gate')).toContainText('成功返回 resource:A');
  await expect(page.locator('.resource-gate')).toContainText('已调用，收到三个 None');
  await page.getByRole('button',{name:'重置观察',exact:true}).click();
  await expect(page.getByRole('button',{name:'进入失败',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.resource-output')).toHaveCount(0);
  await page.getByRole('button',{name:'02 退出与抑制',exact:true}).click();
  const output=page.locator('.resource-output');
  for(const selective of [true,false]) {
    await page.getByRole('radio',{name:selective?'只抑制 ValueError':'清理后继续传播',exact:true}).check();
    for(const body of ['正常完成','抛 ValueError','抛 TypeError']) {
      await page.getByRole('button',{name:body,exact:true}).click();
      await page.getByRole('button',{name:'观察退出结果',exact:true}).click();
      const normal=body==='正常完成';
      await expect(page.locator('.resource-envelope dd').nth(0)).toHaveText(normal?'None':body.slice(2));
      await expect(page.locator('.resource-envelope dd').nth(2)).toHaveText(normal?'None':'traceback 对象');
      const continued=normal||(selective&&body==='抛 ValueError');
      if(continued) await expect(output).toContainText('after with');
      else {await expect(output).toContainText('outer caught');await expect(output).not.toContainText('after with');}
      if(normal) await expect(output).toContainText('body tail');
      else await expect(output).not.toContainText('body tail');
      await noOverflow();
      if(selective&&body==='抛 ValueError') await shot('exit-suppressed');
    }
  }
  await page.getByRole('button',{name:'03 逆序清理',exact:true}).click();
  for(const label of ['两个资源都成功','B 进入失败','使用时失败']) {
    await page.getByRole('button',{name:label,exact:true}).click();
    const next=page.getByRole('button',{name:'下一个事件',exact:true});
    let count=0;
    while(await next.isEnabled()) {
      await next.focus(); await page.keyboard.press('Enter'); count++;
      if(count===6&&label==='两个资源都成功') {
        await expect(page.locator('.resource-stack li').nth(0)).toContainText('B.__exit__');
        await expect(page.locator('.resource-stack li').nth(1)).toContainText('A.__exit__');
        await shot('stack-pending');
      }
      if(count===5&&label==='B 进入失败') {
        await expect(page.locator('.resource-inventory')).toContainText('进入失败 · 未登记');
        await expect(page.locator('.resource-stack li')).toHaveCount(1);
        await expect(page.locator('.resource-stack li')).toContainText('A.__exit__');
        await shot('stack-failure');
      }
      expect(count).toBeLessThan(15);
    }
    await expect(page.locator('.resource-stack')).toContainText('已无待清理项');
    await expect(page.locator('.resource-inventory')).toContainText('已退出');
    if(label==='B 进入失败') await expect(page.locator('.resource-inventory')).toContainText('进入失败 · 未登记');
    await noOverflow();
    await page.getByRole('button',{name:'上一个事件',exact:true}).click();
    await expect(next).toBeEnabled();
    await page.getByRole('button',{name:'重置清理过程',exact:true}).click();
    await expect(page.locator('.resource-event')).toContainText('事件 0');
  }
  await page.getByRole('button',{name:'04 自己动手',exact:true}).click();
  await expect(page.locator('.quiz')).toBeVisible();
  await page.getByRole('button',{name:'第 3 题',exact:true}).click();
  await expect(page.locator('.quiz')).toBeVisible();
  await page.getByText('本地编程 · 实现可控的资源管理',{exact:true}).click();
  await expect(page.getByRole('link',{name:'下载配套项目与测试',exact:true})).toHaveAttribute('href',/^data:application\/zip/);
  await noOverflow();
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await expect(page.locator('.sample-recap-grid>div')).toHaveCount(3);
  const read=page.getByRole('checkbox',{name:'已阅读并回顾本章',exact:true});
  await read.check(); await page.reload();
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await expect(read).toBeChecked();
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  for(const id of ['08-with','08-enter-fail','08-exitstack']) await expect(page.locator(`[data-scenario-id="${id}"]`)).toBeVisible();
  await noOverflow(); expect(errors).toEqual([]);
});
