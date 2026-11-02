import {test as base,expect} from '@playwright/test';
import {mkdtemp,mkdir,copyFile,rm,readFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chapters} from '../../src/content/chapters';
const test=base.extend<{offlineUrl:string}>({
  offlineUrl:async({context},use)=>{
    const baseDir=resolve('.test-temp');
    await mkdir(baseDir,{recursive:true});
    const folder=await mkdtemp(join(baseDir,'offline-file-'));
    if(!resolve(folder).startsWith(baseDir+sep))throw new Error('Unsafe temporary path');
    await copyFile('index.html',join(folder,'index.html'));
    await context.setOffline(true);
    try{await use(pathToFileURL(join(folder,'index.html')).href);}
    finally{await context.close();await rm(folder,{recursive:true,force:true});}
  },
});
test('actual entry and isolated single HTML work offline across all chapters',async({page,offlineUrl})=>{
  const errors:string[]=[];const network:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(pathToFileURL(resolve('index.html')).href);
  await expect(page.getByRole('heading',{level:1})).toContainText('读懂每一次异常');
  await page.goto(offlineUrl);
  for(const chapter of chapters){
    const directory=page.getByRole('button',{name:/^目录/});
    await directory.focus();await directory.press('Space');
    await expect(page.getByRole('navigation',{name:'课程章节'})).toBeVisible();
    await page.getByRole('navigation',{name:'课程章节'}).locator('a[href="#/'+chapter.id+'"]').click();
    await expect(page.getByRole('heading',{level:1})).toHaveText(chapter.title);
    const diagrams:Record<string,string>={'01':'.foundation-pipeline','02':'.codebox','03':'.codebox','04':'.call-stack-diagram','05':'.family-diagram','06':'.rethrow-route','07':'.contract-route','08':'.resource-gate','09':'.diagnostic-reader','10':'.retry-budget','11':'.concurrent-split','12':'.project-entry'};
    await expect(page.locator(diagrams[chapter.id])).not.toHaveCount(0);
    await page.getByRole('button',{name:'自由实验',exact:true}).click();
    await page.getByRole('button',{name:'下一步',exact:true}).click();
    await expect(page.getByRole('slider')).toHaveValue('0');
    await page.getByRole('button',{name:'重置实验'}).click();
    await expect(page.getByRole('slider')).toHaveValue('-1');
    await page.getByRole('button',{name:/^\d{2} 自己动手$/}).click();
    const quiz=page.locator('.quiz').first();
    await quiz.getByRole('radio').nth(chapter.quizzes[0].answer).check();
    await quiz.getByRole('button',{name:'检查答案'}).click();
    await expect(quiz.getByRole('status')).toContainText('判断正确');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);expect(network).toEqual([]);
});
test('file progress survives refresh and can be exported and imported',async({page,offlineUrl})=>{
  const recap=()=>page.getByRole('button',{name:/^\d{2} 回顾$/}).click();
  await page.goto(offlineUrl+'#/01');
  await recap();
  await page.getByLabel('已阅读并回顾本章').check();
  await page.reload();await recap();
  await expect(page.getByLabel('已阅读并回顾本章')).toBeChecked();
  await page.getByText('学习记录、掌握度规则与设置',{exact:true}).click();
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出进度',exact:true}).click();
  const download=await downloaded;
  const contents=await readFile((await download.path())!);
  expect(JSON.parse(contents.toString()).chapters['01'].read).toBe(true);
  await page.getByRole('button',{name:'重置学习记录',exact:true}).click();
  await page.getByRole('button',{name:'确认清空',exact:true}).click();await recap();
  await expect(page.getByLabel('已阅读并回顾本章')).not.toBeChecked();
  await page.getByLabel('选择进度 JSON 文件').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:contents});
  await recap();
  await expect(page.getByLabel('已阅读并回顾本章')).toBeChecked();
  await page.reload();await recap();
  await expect(page.getByLabel('已阅读并回顾本章')).toBeChecked();
});
test('embedded Python archive downloads without sibling files or HTTP',async({page,offlineUrl})=>{
  await page.goto(offlineUrl);
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('link',{name:'下载 Python 配套包'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('python-course.zip');
  expect(await readFile((await download.path())!)).toEqual(await readFile('public/python-course.zip'));
});
