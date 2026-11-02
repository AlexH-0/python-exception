import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {chapters} from '../../src/content/chapters';
import type {Scenario} from '../../src/content/schema';
const chapter=chapters.find(c=>c.id==='02')!;
const scenes=(JSON.parse(readFileSync('src/data/traces.json','utf8')) as Scenario[]).filter(s=>s.chapter==='02');
const screens=['01 正常路径','02 匹配顺序','03 保护边界','04 自己动手','05 回顾','自由实验'];

test('short lessons connect code and output, and mistakes never block the next lesson',async({page})=>{
  await page.goto('/#/02');
  await page.locator('.sample-choices button').nth(1).click();
  await expect(page.locator('.sample-feedback')).toContainText('再看一下');
  const normal=scenes.find(s=>s.id==='02-match-normal')!;
  const outputs=normal.steps.filter(s=>s.event==='output');
  for(const event of outputs){
    await page.getByRole('button',{name:'下个节点',exact:true}).click();
    await expect(page.getByLabel('教学累计输出')).toHaveText(event.output.join('\n'));
    await expect(page.locator('.codebox [aria-current="step"]')).toContainText(normal.code.split('\n')[event.line-1].trim());
  }
  await expect(page.getByRole('button',{name:'下个节点',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'上个节点',exact:true}).click();
  await expect(page.getByLabel('教学累计输出')).toHaveText(outputs.at(-2)!.output.join('\n'));
  await page.getByRole('button',{name:'重走路径',exact:true}).click();
  await expect(page.getByLabel('教学累计输出')).toHaveText('（尚无输出）');
  await page.getByRole('button',{name:'下一节 →',exact:true}).click();
  await expect(page.getByRole('heading',{name:'KeyError 会被谁接住？'})).toBeFocused();
  await page.locator('.sample-handler-list button').nth(1).click();
  await expect(page.locator('.sample-feedback')).toContainText('顺序决定结果');
  await expect(page.getByLabel('教学累计输出')).toHaveText('try\nlookup handled');
  await expect(page.locator('.sample-handler-list button').first()).toContainText('首个匹配');
  await page.getByRole('button',{name:'下一节 →',exact:true}).click();
  await page.getByRole('button',{name:'在 else 中抛错',exact:true}).click();
  await page.getByRole('button',{name:'查看这次运行',exact:true}).click();
  const failure=scenes.find(s=>s.id==='02-match-else-error')!;
  await expect(page.getByLabel('教学累计输出')).toHaveText(failure.output.join('\n'));
  await expect(page.locator('.sample-feedback')).toContainText(failure.exception!);
  await page.getByRole('button',{name:'正常结束',exact:true}).click();
  await expect(page.getByLabel('教学累计输出')).toHaveCount(0);
  await page.getByRole('button',{name:'查看这次运行',exact:true}).click();
  await expect(page.getByLabel('教学累计输出')).toHaveText(normal.output.join('\n'));
});

test('sample quiz permits continuing after mistakes and preserves genuine attempts',async({page})=>{
  await page.goto('/#/02');
  await page.getByRole('button',{name:'04 自己动手',exact:true}).click();
  const quiz=page.locator('.quiz');
  await quiz.getByRole('radio').nth((chapter.quizzes[0].answer+1)%chapter.quizzes[0].options.length).check();
  await quiz.getByRole('button',{name:'检查答案'}).click();
  await expect(quiz.getByRole('status')).toContainText('再检查这条执行路径');
  await page.getByRole('button',{name:'第 2 题',exact:true}).click();
  await expect(quiz.locator('h3')).toHaveText(chapter.quizzes[1].question);
  await quiz.getByRole('radio').nth(chapter.quizzes[1].answer).check();
  await quiz.getByRole('button',{name:'检查答案'}).click();
  await expect(quiz.getByRole('status')).toContainText('判断正确');
  await page.reload();
  await page.getByRole('button',{name:'04 自己动手',exact:true}).click();
  await expect(quiz).toContainText('已作答 1 次 · 答对 0 次');
  await page.getByRole('button',{name:'第 2 题',exact:true}).click();
  await expect(quiz).toContainText('已作答 1 次 · 答对 1 次');
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await page.getByLabel('已阅读并回顾本章').check();
  await page.reload();
  await page.getByRole('button',{name:'05 回顾',exact:true}).click();
  await expect(page.getByLabel('已阅读并回顾本章')).toBeChecked();
});

test('sample scenario cards reset playback and all results agree with Python traces',async({page})=>{
  await page.goto('/#/02');
  await page.getByRole('button',{name:'自由实验',exact:true}).click();
  const slider=page.getByRole('slider',{name:'事件位置'});
  for(const scene of scenes){
    await page.getByRole('button',{name:scene.title}).click();
    await expect(slider).toHaveValue('-1');
    await expect(page.getByLabel('累计标准输出')).toHaveText('（尚无输出）');
    await slider.fill(String(scene.steps.length-1));
    await expect(page.getByLabel('累计标准输出')).toHaveText(scene.output.join('\n'));
    await expect(page.locator('.final-outcome')).toContainText(scene.exception??'未向外抛出异常');
    await expect(page.locator('.codebox [aria-current="step"]')).toContainText(scene.code.split('\n')[scene.steps.at(-1)!.line-1].trim());
  }
});

test('sample screens have accessible controls and fit narrow viewports',async({page},testInfo)=>{
  test.setTimeout(120000);
  await page.goto('/#/02');
  await mkdir('docs/qa/sample',{recursive:true});
  for(const [i,name] of screens.entries()){
    await page.getByRole('button',{name,exact:true}).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    expect(result.violations, name).toEqual([]);
    if([0,1,2,5].includes(i)){
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:`docs/qa/sample/${testInfo.project.name}-${i+1}.png`,fullPage:true,animations:'disabled'});
    }
  }
  await page.getByRole('button',{name:'02 匹配顺序',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('h2:focus')).toHaveCount(1);
});
