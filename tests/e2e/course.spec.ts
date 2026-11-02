import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { chapters } from '../../src/content/chapters';
import {readFileSync} from 'node:fs';
import type {Scenario} from '../../src/content/schema';
const traces = JSON.parse(readFileSync('src/data/traces.json','utf8')) as Scenario[];
test('home, all chapter navigation, offline core, no console errors',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const external:string[]=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173')&&!r.url().startsWith('data:'))external.push(r.url());});
  await page.goto('/');
  await expect(page.getByRole('heading',{level:1})).toContainText('读懂每一次异常');
  for(const c of chapters) {
    await page.goto('/#/'+c.id);
    await expect(page.getByRole('heading',{level:1})).toHaveText(c.title);
    await expect(page.locator('.breadcrumb .badge')).toContainText(c.minutes+' 分钟');
    {
      const diagrams:Record<string,string>={'01':'.foundation-pipeline','02':'.codebox','03':'.codebox','04':'.call-stack-diagram','05':'.family-diagram','06':'.rethrow-route','07':'.contract-route','08':'.resource-gate','09':'.diagnostic-reader','10':'.retry-budget','11':'.concurrent-split','12':'.project-entry'};
      await expect(page.locator(diagrams[c.id])).not.toHaveCount(0);
      await page.getByRole('button',{name:'自由实验',exact:true}).click();
      await expect(page.getByRole('heading',{name:'换个场景，再观察一次'})).toBeVisible();
      for(const id of c.scenarioIds) await expect(page.locator('[data-scenario-id="'+id+'"]')).toBeVisible();
      await page.getByRole('button',{name:/^\d{2} 自己动手$/}).click();
      for(const [i,q] of c.quizzes.entries()) {
        await page.getByRole('button',{name:'第 '+(i+1)+' 题',exact:true}).click();
        await expect(page.locator('.quiz').getByRole('radio')).toHaveCount(q.options.length);
        await expect(page.locator('.quiz h3')).toHaveText(q.question);
      }
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);expect(external).toEqual([]);
});
test('real trace controls, state reset, reduced motion and keyboard',async({page})=>{
  await page.goto('/#/02');
  const scene = traces.find(s=>s.id==='02-match-normal')!;
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  await page.getByRole('button',{name:scene.title}).click();
  const slider=page.getByRole('slider',{name:'事件位置'});
  await slider.fill(String(scene.steps.length-1));
  await expect(page.getByLabel('累计标准输出')).toHaveText(scene.output.join('\n'));
  await expect(page.getByRole('button',{name:'下一步',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'重置实验'}).click();
  await expect(slider).toHaveValue('-1');
  await page.getByRole('button',{name:'下一步',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(slider).toHaveValue('0');
  await page.getByRole('button',{name:'播放',exact:true}).click();
  await expect(slider).not.toHaveValue('0');
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.getByRole('button',{name:'播放',exact:true})).toBeDisabled();
  await page.getByText('完整事件列表（静态替代，可直接阅读）').click();
  await expect(page.locator('.static-trace>li')).toHaveCount(scene.steps.length);
});
test('practice feedback, persistence, import rejection and reset',async({page})=>{
  await page.goto('/#/01');
  const practice=()=>page.getByRole('button',{name:'04 自己动手',exact:true}).click();
  const recap=()=>page.getByRole('button',{name:'05 回顾',exact:true}).click();
  const q=chapters[0].quizzes[0];
  const quiz=page.locator('.quiz').first();
  await practice();
  await quiz.getByRole('radio').nth(q.answer).check();
  await quiz.getByRole('button',{name:'检查答案'}).click();
  await expect(quiz.getByRole('status')).toContainText('判断正确');
  await recap();await page.getByLabel('已阅读并回顾本章').check();
  await page.reload();await recap();
  await expect(page.getByLabel('已阅读并回顾本章')).toBeChecked();
  await practice();await expect(quiz).toContainText('已作答 1 次');
  await page.getByText('学习记录、掌握度规则与设置', {exact:true}).click();
  await page.getByLabel('选择进度 JSON 文件').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"schema":99}')});
  await expect(page.getByRole('status').first()).toContainText('导入失败');
  await recap();await expect(page.getByLabel('已阅读并回顾本章')).toBeChecked();
  await page.getByRole('button',{name:'重置学习记录',exact:true}).click();
  await page.getByRole('button',{name:'取消',exact:true}).click();
  await expect(page.getByLabel('已阅读并回顾本章')).toBeChecked();
  await page.getByRole('button',{name:'重置学习记录',exact:true}).click();
  await page.getByRole('button',{name:'确认清空',exact:true}).click();
  await recap();await expect(page.getByLabel('已阅读并回顾本章')).not.toBeChecked();
  await practice();
  await expect(quiz.getByRole('status')).toHaveCount(0);
  await expect(quiz.getByRole('button',{name:'检查答案'})).toBeDisabled();
  await expect(quiz.locator('input:checked')).toHaveCount(0);
  // A valid replacement import must also reset transient answer/hint state.
  await quiz.getByRole('button',{name:/提示 1/}).click();
  await quiz.getByRole('radio').nth(q.answer).check();
  await quiz.getByRole('button',{name:'检查答案'}).click();
  const valid={schema:1,lastChapter:'02',chapters:{'02':{read:true,practice:false}},answers:{},settings:{reducedMotion:true}};
  await page.getByLabel('选择进度 JSON 文件').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(valid))});
  await practice();
  await expect(quiz.getByRole('status')).toHaveCount(0);
  await expect(quiz.locator('.hint')).toHaveCount(0);
  await expect(quiz.getByRole('button',{name:'检查答案'})).toBeDisabled();
  await page.reload();await page.goto('/#/02');
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await expect(page.getByLabel('已阅读并回顾本章')).toBeChecked();
});

test('corrupt storage falls back and blocked storage remains usable',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('exception-lab:progress:v1','not json'));
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('无法读取本地进度');
  await page.goto('/#/01');
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('blocked','SecurityError');};});
  await page.getByLabel('已阅读并回顾本章').check();
  await expect(page.getByRole('status')).toContainText('无法保存进度');
});
test('representative pages satisfy automated accessibility checks',async({page})=>{
  for(const route of ['home','01','11','12']) {
    await page.goto('/#/'+route);
    // Measure the reading state after finite entrance animations and fonts settle.
    await page.evaluate(async()=>{
      await document.fonts.ready;
      await Promise.allSettled(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished));
    });
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    expect(result.violations).toEqual([]);
  }
});
test('blocked persistence never claims reset or import was saved',async({page})=>{
  await page.goto('/#/01');
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await page.getByLabel('已阅读并回顾本章').check();
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('blocked','SecurityError');};});
  await page.getByText('学习记录、掌握度规则与设置',{exact:true}).click();
  await page.getByRole('button',{name:'重置学习记录',exact:true}).click();
  await page.getByRole('button',{name:'确认清空',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('仅清空了当前会话');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('exception-lab:progress:v1')!));
  expect(saved.chapters['01'].read).toBe(true);
  const valid={schema:1,lastChapter:'01',chapters:{},answers:{},settings:{reducedMotion:false}};
  await page.getByLabel('选择进度 JSON 文件').setInputFiles({name:'valid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(valid))});
  await expect(page.getByRole('status')).toContainText('仅导入当前会话');
});
test('download contains a real ZIP and skip navigation moves focus',async({page,request})=>{
  const response=await request.get('/python-course.zip');
  expect(response.ok()).toBe(true);expect((await response.body()).subarray(0,2).toString()).toBe('PK');
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'跳转到正文'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
});
