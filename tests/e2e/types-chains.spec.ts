import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const hierarchy=JSON.parse(readFileSync('src/data/hierarchy.json','utf8'));
const chain=JSON.parse(readFileSync('src/data/chaining.json','utf8'));

async function capture(page: import('@playwright/test').Page,path:string) {
  await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
  await page.screenshot({path,fullPage:true});
}

test('type family and catch boundary work offline',async({page,context},info)=>{
  await context.setOffline(true);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(resolve('index.html')).href+'#/05');
  await mkdir('docs/qa/types-chains',{recursive:true});
  await page.getByRole('group',{name:'选择常规错误类型族'}).getByRole('button',{name:/OSError/}).click();
  await page.getByRole('group',{name:'OSError 的直接子类'}).getByRole('button',{name:/FileNotFoundError/}).click();
  await expect(page.locator('.hierarchy-path')).toHaveText('FileNotFoundError → OSError → Exception → BaseException');
  await page.getByRole('group',{name:'选择控制信号类型'}).getByRole('button',{name:/KeyboardInterrupt/}).click();
  await expect(page.locator('.hierarchy-path')).toHaveText('KeyboardInterrupt → BaseException');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await capture(page,`docs/qa/types-chains/${info.project.name}-05-family.png`);
  await page.getByRole('button',{name:'02 捕获范围',exact:true}).click();
  for(const handler of ['LookupError','OSError','Exception','BaseException']){
    await page.getByRole('button',{name:`except ${handler}:`,exact:true}).click();
    await expect(page.locator('.is-match')).toHaveCount(Object.values(hierarchy.matches[handler]).filter(Boolean).length);
  }
  await page.getByRole('button',{name:'03 处理边界',exact:true}).click();
  await page.getByRole('button',{name:'KeyboardInterrupt / SystemExit / GeneratorExit',exact:true}).click();
  await page.getByRole('button',{name:'静默忽略所有信号',exact:true}).click();
  await expect(page.locator('.hierarchy-situation [role=status]')).toContainText('再想一想');
  await page.getByRole('button',{name:'下一节 →',exact:true}).click();
  await expect(page.locator('.quiz')).toBeVisible();
  expect(errors).toEqual([]);
});

test('rethrow identity, chain display and notes work offline',async({page,context},info)=>{
  await context.setOffline(true);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(resolve('index.html')).href+'#/06');
  await mkdir('docs/qa/types-chains',{recursive:true});
  await page.getByRole('button',{name:'raise error',exact:true}).click();
  await expect(page.locator('.rethrow-frames>div')).toHaveCount(2);
  await expect(page.locator('.object-same')).toContainText('同一个异常对象');
  await page.getByRole('button',{name:'转换成 InputError',exact:true}).click();
  await expect(page.locator('.object-new')).toContainText('InputError');
  await page.getByRole('button',{name:'02 异常链',exact:true}).click();
  await page.getByRole('button',{name:'from None',exact:true}).click();
  await expect(page.getByLabel('默认异常摘要')).toHaveText(chain.chains.find((s:{id:string})=>s.id==='hidden').display.join('\n\n'));
  await page.getByRole('button',{name:'看对象关系',exact:true}).click();
  await expect(page.locator('.original-object')).toContainText('ValueError');
  await expect(page.locator('.chain-links')).toContainText('None');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await capture(page,`docs/qa/types-chains/${info.project.name}-06-chain.png`);
  await page.getByRole('button',{name:'03 附加线索',exact:true}).click();
  await page.getByRole('checkbox',{name:/是哪一个字段/}).check();
  await page.getByRole('checkbox',{name:/是哪一条任务/}).check();
  await expect(page.getByLabel('备注异常摘要')).toHaveText(chain.notes.find((s:{id:string})=>s.id==='3').display);
  await expect(page.locator('.note-paper-header')).toContainText('ValueError');
  await capture(page,`docs/qa/types-chains/${info.project.name}-06-notes.png`);
  expect(errors).toEqual([]);
});
