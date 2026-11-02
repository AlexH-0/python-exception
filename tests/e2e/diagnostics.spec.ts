import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
const evidence = JSON.parse(readFileSync(resolve('src/data/diagnostics.json'), 'utf8'));

test('chapter 09 locates failures and replays real logging and pytest evidence offline',async({page,context},info)=>{
  await context.setOffline(true);
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await mkdir('docs/qa/diagnostics',{recursive:true});
  const shot=async(name:string)=>{
    await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
    await page.screenshot({path:`docs/qa/diagnostics/${info.project.name}-${name}.png`,fullPage:true});
  };
  await page.goto(pathToFileURL(resolve('index.html')).href+'#/09');
  await expect(page.locator('.sample-nav button')).toHaveCount(6);
  await expect(page.locator('.diagnostic-frames button')).toHaveCount(4);
  for(let i=0;i<4;i++) {
    const frame=page.locator('.diagnostic-frames button').nth(i);
    await frame.focus();await page.keyboard.press('Enter');
    await expect(frame).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.diagnostic-source .active-line .code-source')).toHaveText(evidence.trace.code.split('\n')[evidence.trace.frames[i].line-1]);
  }
  await expect(page.locator('.diagnostic-explanation')).toContainText('整数转换失败');
  await shot('traceback');await noOverflow();
  await page.getByRole('button',{name:'回到异常摘要',exact:true}).click();
  await expect(page.locator('.diagnostic-error-line')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'02 记录现场',exact:true}).click();
  for(const item of evidence.logs) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    await expect(page.locator('.diagnostic-record')).toContainText('待观察');
    await page.getByRole('button',{name:'查看这次记录',exact:true}).click();
    await expect(page.locator('.diagnostic-record')).toContainText('task_id=job-9');
    await expect(page.locator('.diagnostic-record')).toContainText(item.id==='message'?'无 · 只有消息文本':'有 · 类型、实例与 traceback');
    await expect(page.locator('.diagnostic-record-end')).toHaveText(item.id==='reraise'?'没有执行处理器之后的代码':'执行了处理器之后的代码');
    await page.getByText('展开这条日志的实际格式化结果',{exact:true}).click();
    if(item.id==='message') await expect(page.locator('.diagnostic-formatted pre')).not.toContainText('Traceback');
    else await expect(page.locator('.diagnostic-formatted pre')).toContainText('Traceback');
    if(item.id==='reraise') await shot('logging');
    await noOverflow();
  }
  await page.getByRole('button',{name:'03 验证契约',exact:true}).click();
  const counts=page.locator('.diagnostic-test-counts strong');
  for(const impl of evidence.testing.implementations) {
    await page.getByRole('button',{name:impl.label,exact:true}).click();
    for(const suite of evidence.testing.suites) {
      await page.getByRole('button',{name:new RegExp(suite.label)}).click();
      await page.getByRole('button',{name:'查看这组验证结果',exact:true}).click();
      const failed=impl.id!=='correct'&&suite.id==='contract';
      await expect(counts.nth(0)).toHaveText(suite.id==='contract'?(failed?'2':'3'):'1');
      await expect(counts.nth(1)).toHaveText(failed?'1':'0');
      if(impl.id!=='correct'&&suite.id!=='contract') await expect(page.locator('.diagnostic-test-result')).toContainText('测试通过，但漏掉了错误');
      if(failed) await expect(page.locator('.diagnostic-test-result')).toContainText('发现契约被破坏');
      if(impl.id==='cause-bug'&&suite.id==='type') await shot('tests-missed');
      if(impl.id==='cause-bug'&&suite.id==='contract') await shot('tests-caught');
      await noOverflow();
    }
  }
  await page.getByRole('button',{name:'04 自己动手',exact:true}).click();
  await expect(page.locator('.quiz')).toBeVisible();
  await page.getByRole('button',{name:'第 3 题',exact:true}).click();
  await expect(page.locator('.quiz')).toContainText('exc_info.value');
  await page.getByText('本地编程 · 记录并返回异常诊断',{exact:true}).click();
  await expect(page.getByRole('link',{name:'下载配套项目与测试',exact:true})).toHaveAttribute('href',/^data:application\/zip/);
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await expect(page.locator('.sample-recap-grid>div')).toHaveCount(3);
  const read=page.getByRole('checkbox',{name:'已阅读并回顾本章',exact:true});
  await read.check();await page.reload();
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await expect(read).toBeChecked();
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  await expect(page.locator('[data-scenario-id="09-diagnose"]')).toBeVisible();
  await noOverflow();expect(errors).toEqual([]);
});
