import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chapters } from '../../src/content/chapters';
import { emptyProgress, recordAnswer, STORAGE_KEY } from '../../src/progress';
const entry=pathToFileURL(resolve('index.html')).href;
const noOverflow=async(page:import('@playwright/test').Page)=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);

test('all chapters share previous and next links, transitions and focus offline',async({page,context})=>{
  await context.setOffline(true);await page.emulateMedia({reducedMotion:'no-preference'});
  const errors:string[]=[];const network:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
  await page.goto(entry+'#/01');
  const neighbors=page.getByRole('navigation',{name:'相邻章节',exact:true});
  for(const [i,c] of chapters.entries()) {
    await expect(page.getByRole('heading',{level:1})).toHaveText(c.title);
    await expect(neighbors.getByRole('link').first()).toHaveAttribute('href',i?'#/'+chapters[i-1].id:'#/home');
    await expect(neighbors.getByRole('link').last()).toHaveAttribute('href',i<chapters.length-1?'#/'+chapters[i+1].id:'#/home');
    await expect(page.locator('.sample-footer a').first()).toHaveAttribute('href',i?'#/'+chapters[i-1].id:'#/home');
    expect(await page.locator('.chapter-route').evaluate(e=>getComputedStyle(e).animationName)).toBe('course-arrive');
    expect(await page.locator('.sample-stage').evaluate(e=>getComputedStyle(e).animationDuration)).toBe('0.16s');
    if(i)await expect(page.locator('main')).toBeFocused();
    await noOverflow(page);await neighbors.getByRole('link').last().click();
  }
  await expect(page).toHaveURL(/#\/home$/);await expect(page.locator('main')).toBeFocused();
  await page.goto(entry+'#/12');
  for(const c of chapters.slice().reverse()) {
    await expect(page.getByRole('heading',{level:1})).toHaveText(c.title);
    await neighbors.getByRole('link').first().click();
    await expect(page.locator('main')).toBeFocused();
  }
  await expect(page).toHaveURL(/#\/home$/);
  await page.goBack();await expect(page).toHaveURL(/#\/01$/);await expect(page.locator('main')).toBeFocused();
  await page.goForward();await expect(page).toHaveURL(/#\/home$/);await expect(page.locator('main')).toBeFocused();
  for(const id of ['02','11','12']) {
    await page.goto(entry+'#/'+id);
    await page.locator('.sample-footer').getByRole('button',{name:'下一节 →',exact:true}).click();
    await expect(page.locator('.sample-screen-heading h2')).toBeFocused();
    expect(await page.locator('.sample-stage').evaluate(e=>getComputedStyle(e).animationName)).toBe('lesson-arrive');
    await page.locator('.sample-footer').getByRole('button',{name:'← 上一节',exact:true}).click();
    await expect(page.locator('.sample-screen-heading h2')).toBeFocused();
    await page.getByRole('button',{name:'自由实验',exact:true}).click();
    await page.locator('.sample-footer').getByRole('button',{name:'返回本节',exact:true}).click();
    await expect(page.locator('.sample-screen-heading h2')).toBeFocused();
    await page.getByRole('button',{name:/^\d{2} 回顾$/}).click();
    const next=chapters[chapters.findIndex(c=>c.id===id)+1];
    await expect(page.locator('.sample-footer a').last()).toHaveAttribute('href',next?'#/'+next.id:'#/home');
    await noOverflow(page);
  }
  expect(errors).toEqual([]);expect(network).toEqual([]);
});

test('edge progress directory supports hover, keyboard, touch and reliable closure',async({page,context,isMobile},info)=>{
  await context.setOffline(true);await page.emulateMedia({reducedMotion:'reduce'});
  let saved=emptyProgress();saved.chapters['01']={read:true,practice:true};
  for(const quiz of chapters[0].quizzes)saved=recordAnswer(saved,quiz.id,true,false);
  await page.addInitScript(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key:STORAGE_KEY,saved});
  await page.goto(entry+'#/02');
  await mkdir('docs/qa/navigation',{recursive:true});
  const shot=async(name:string)=>{await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`docs/qa/navigation/${info.project.name}-${name}.png`,fullPage:true});};
  const trigger=page.getByRole('button',{name:'目录1/12，已完成自测',exact:true});
  const drawer=page.locator('#course-drawer');
  await expect(drawer).toBeHidden();await expect(drawer).toHaveAttribute('inert','');
  await expect(page.locator('.rail-complete')).toHaveCount(1);await expect(page.locator('.rail-current')).toHaveCount(1);
  const before=await page.locator('main').boundingBox();await shot('closed');
  await page.locator('main').evaluate(el=>(el as HTMLElement).focus({preventScroll:true}));
  if(!isMobile) {
    const box=(await trigger.boundingBox())!;await page.mouse.move(3,130);
    await expect(drawer).toBeVisible();
    expect(await page.locator('main').boundingBox()).toEqual(before);
    await page.mouse.move(page.viewportSize()!.width-6,10);
    await expect(drawer).toBeHidden();
    await page.mouse.move(3,box.y+box.height/2);await expect(drawer).toBeVisible();
    await drawer.getByRole('link').first().hover();
    await page.keyboard.press('Escape');await expect(drawer).toBeHidden();await expect(page.locator('main')).toBeFocused();
    await page.mouse.move(page.viewportSize()!.width-6,10);
  }
  await trigger.focus();await page.keyboard.press('Space');
  await expect(drawer).toBeVisible();await expect(drawer.locator('.chapter-link[aria-current="page"]')).toBeFocused();
  expect(await page.locator('main').boundingBox()).toEqual(before);await shot('open');await noOverflow(page);
  await page.keyboard.press('Escape');await expect(drawer).toBeHidden();await expect(trigger).toBeFocused();
  await page.keyboard.press('Tab');await expect(page.locator('main a').first()).toBeFocused();
  if(isMobile)await trigger.tap();else await trigger.click();
  await expect(drawer).toBeVisible();
  await drawer.locator('a[href="#/11"]').click();
  await expect(page).toHaveURL(/#\/11$/);await expect(drawer).toBeHidden();await expect(page.locator('main')).toBeFocused();
  await trigger.focus();await page.keyboard.press('Space');
  await expect(drawer.locator('.chapter-link[aria-current="page"]')).toHaveAttribute('href','#/11');
  await drawer.locator('.chapter-link[aria-current="page"]').click();
  await expect(drawer).toBeHidden();await expect(page.locator('main')).toBeFocused();
  if(isMobile)await trigger.tap();else {await page.mouse.move(page.viewportSize()!.width-6,10);await trigger.focus();await page.keyboard.press('Space');}
  await expect(drawer).toBeVisible();
  await page.mouse.click(page.viewportSize()!.width-6,page.viewportSize()!.height-8);
  await expect(drawer).toBeHidden();await noOverflow(page);
});

test('navigation respects both motion settings and passes accessibility checks',async({page,context})=>{
  await context.setOffline(true);await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(entry+'#/01');
  const animation=async(selector:string)=>page.locator(selector).evaluate(e=>getComputedStyle(e).animationName);
  expect(await animation('.chapter-route')).toBe('none');expect(await animation('.sample-stage')).toBe('none');
  const scan=async()=>expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze()).violations).toEqual([]);
  await scan();
  const trigger=page.getByRole('button',{name:/^目录\d+\/12，已完成自测$/});
  await trigger.focus();await page.keyboard.press('Space');
  expect(await animation('#course-drawer')).toBe('none');await scan();
  await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByText('学习记录、掌握度规则与设置',{exact:true}).click();
  await page.getByLabel('减少动效（系统偏好同样生效）',{exact:true}).check();
  expect(await animation('.chapter-route')).toBe('none');expect(await animation('.sample-stage')).toBe('none');
  await trigger.focus();await page.keyboard.press('Space');expect(await animation('#course-drawer')).toBe('none');
  await page.keyboard.press('Escape');await page.reload();
  await expect(page.locator('.app')).toHaveAttribute('data-reduced-motion','true');expect(await animation('.chapter-route')).toBe('none');
});
