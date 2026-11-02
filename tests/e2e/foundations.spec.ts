import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chapters } from '../../src/content/chapters';
const data=JSON.parse(readFileSync(resolve('src/data/foundations.json'),'utf8'));

test('chapter 01 explains phases, objects and traceback with real evidence offline',async({page,context},info)=>{
  await context.setOffline(true);await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const noOverflow=async()=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await mkdir('docs/qa/foundations',{recursive:true});
  const shot=async(name:string)=>{await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:`docs/qa/foundations/${info.project.name}-${name}.png`,fullPage:true});};
  await page.goto(pathToFileURL(resolve('index.html')).href+'#/01');
  await expect(page.locator('.sample-nav button')).toHaveCount(6);
  for(const item of data.phases) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    await expect(page.getByLabel('脚本标准输出')).toHaveText('（尚未揭示）');
    const prediction=page.getByRole('button',{name:item.id==='syntax'?'不会打印':'会打印',exact:true});
    await prediction.focus();await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'查看 Python 的实际结果',exact:true}).click();
    await expect(page.getByLabel('脚本标准输出')).toHaveText(item.stdout.join('\n')||'（没有输出）');
    await expect(page.locator('.foundation-phase-result')).toContainText('预测与结果一致');
    await expect(page.locator('.foundation-pipeline strong')).toHaveText([item.compiled?'通过':'SyntaxError',item.compiled?(item.error?.type??'执行到末尾'):'尚未开始']);
    await noOverflow();if(item.id!=='valid')await shot('phase-'+item.id);
  }
  await page.getByRole('button',{name:'重置观察',exact:true}).click();
  await expect(page.getByLabel('脚本标准输出')).toHaveText('（尚未揭示）');
  await expect(page.getByRole('button',{name:'会打印',exact:true})).toHaveAttribute('aria-pressed','false');
  await page.getByRole('button',{name:'02 异常对象',exact:true}).click();
  const fields=['type','message','argsRepr'] as const;
  for(const item of data.objects) {
    await page.getByRole('button',{name:item.label,exact:true}).click();
    for(const [i,key] of fields.entries()) {
      await page.locator('.foundation-fields button').nth(i).click();
      await expect(page.getByLabel('异常字段值')).toHaveText(item.observation[key]);
    }
    await noOverflow();
  }
  await shot('object-args');
  await page.getByText('查看这次观察的完整 Python 脚本',{exact:true}).click();
  await expect(page.locator('.sample-note[open] .codebox')).toContainText("print(observation['argsRepr'])");
  await page.getByRole('button',{name:'03 读第一条回溯',exact:true}).click();
  for(const [i,frame] of data.trace.frames.entries()) {
    await page.locator('.foundation-trace-frame').nth(i).click();
    const source=page.locator('.foundation-trace-source');
    if(await source.getAttribute('open')===null) await source.locator('summary').click();
    await expect(source.locator('.active-line .code-source')).toHaveText(frame.source);
    await expect(page.locator('.foundation-trace-guide')).toContainText(i===data.trace.frames.length-1?'整数转换':'调用下一层');
    await noOverflow();
  }
  await page.locator('.foundation-trace-source summary').click();await shot('traceback');
  await page.getByText('查看 Python 格式化的完整回溯',{exact:true}).click();
  await expect(page.locator('.foundation-formatted')).toHaveText(data.trace.formatted);
  await page.getByRole('button',{name:'从异常行重新读',exact:true}).click();
  await expect(page.locator('.foundation-trace-error')).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'04 自己动手',exact:true}).click();
  for(const [i,q] of chapters[0].quizzes.entries()) {
    await page.getByRole('button',{name:'第 '+(i+1)+' 题',exact:true}).click();
    await page.locator('.quiz').getByRole('radio').nth(q.answer).check();
    await page.locator('.quiz').getByRole('button',{name:'检查答案',exact:true}).click();
    await expect(page.locator('.quiz').getByRole('status')).toContainText('判断正确');
  }
  await page.getByText('本地编程 · '+chapters[0].practice.title,{exact:true}).click();
  await expect(page.getByRole('link',{name:'下载配套项目与测试',exact:true})).toHaveAttribute('href',/^data:application\/zip/);
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  const read=page.getByLabel('已阅读并回顾本章',{exact:true});await read.check();await page.reload();
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();await expect(read).toBeChecked();
  await page.getByText('先修、目标与资料',{exact:true}).click();
  await expect(page.locator('.sample-note[open]')).toContainText('会运行 Python 文件');
  await expect(page.locator('a[href*="会运行"]')).toHaveCount(0);
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  await expect(page.locator('[data-scenario-id="01-errors"]')).toBeVisible();
  const trace=JSON.parse(readFileSync(resolve('src/data/traces.json'),'utf8')).find((s:{id:string})=>s.id==='01-errors');
  await page.getByRole('slider',{name:'事件位置'}).fill(String(trace.steps.length-1));
  await expect(page.getByLabel('累计标准输出')).toHaveText('before');
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await page.locator('.sample-footer').getByRole('link',{name:'下一章 →',exact:true}).click();
  await expect(page).toHaveURL(/#\/02$/);await noOverflow();expect(errors).toEqual([]);
});

test('chapter 01 concept screens pass automated accessibility checks',async({page})=>{
  await page.goto('/#/01');
  for(const label of ['01 错误发生阶段','02 异常对象','03 读第一条回溯']) {
    await page.getByRole('button',{name:label,exact:true}).click();
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    expect(result.violations).toEqual([]);
  }
});
