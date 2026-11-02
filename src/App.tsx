import { useEffect, useRef, useState } from 'react';
import { chapters } from './content/chapters';
import type { Chapter, Scenario } from './content/schema';
import rawTraces from './data/traces.json';
import rawExamples from './data/examples.json';
import { chapterStatus, emptyProgress, loadProgress, parseProgress, recordAnswer, STORAGE_KEY, type Progress } from './progress';
import Code, { Inline } from './Code';
import Quiz from './Quiz';
import TracePlayer from './TracePlayer';
import ConceptMap from './ConceptMap';
import CourseNavigation from './CourseNavigation';
import ChapterOne from './ChapterOne';
import ChapterTwo from './ChapterTwo';
import ChapterThree from './ChapterThree';
import ChapterFour from './ChapterFour';
import ChapterFive from './ChapterFive';
import ChapterSix from './ChapterSix';
import ChapterSeven from './ChapterSeven';
import ChapterEight from './ChapterEight';
import ChapterNine from './ChapterNine';
import ChapterTen from './ChapterTen';
import ChapterEleven from './ChapterEleven';
import ChapterTwelve from './ChapterTwelve';
const guidedPages: Record<string, typeof ChapterThree> = {'01':ChapterOne,'03':ChapterThree,'04':ChapterFour,'05':ChapterFive,'06':ChapterSix,'07':ChapterSeven,'08':ChapterEight,'09':ChapterNine,'10':ChapterTen,'11':ChapterEleven,'12':ChapterTwelve};
declare const __PYTHON_PACKAGE_URL__: string;
const pythonPackageUrl = __PYTHON_PACKAGE_URL__;
const traces = rawTraces as Scenario[];
const examples: Record<string,string> = rawExamples;
function focusSection(id: string) {
  const section = document.getElementById(id);
  if (!section) return;
  const target = section.querySelector<HTMLElement>('h2') ?? section;
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
  section.scrollIntoView();
}
function getRoute() { return window.location.hash.slice(1).split('/')[1] || 'home'; }
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => { const media = window.matchMedia?.('(prefers-reduced-motion: reduce)'); if (!media) return; const change = () => setReduced(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  return reduced;
}
export default function App() {
  const [initial] = useState(() => loadProgress(chapters));
  const [progress, setProgress] = useState<Progress>(initial.progress);
  const [notice, setNotice] = useState(initial.warning);
  const [route, setRoute] = useState(getRoute);
  const [filter, setFilter] = useState('全部');
  const [resetPending, setResetPending] = useState(false);
  const [recordRevision, setRecordRevision] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const main = useRef<HTMLElement>(null);
  const lastRoute = useRef(route);
  const systemReduced = useReducedMotion();
  const chapter = chapters.find(c => c.id === route);
  const Guided = chapter ? guidedPages[chapter.id] : undefined;
  const completed = chapters.filter(c => chapterStatus(c, progress) === '完成自测').length;
  const needsReview = chapters.filter(c => chapterStatus(c, progress) === '待复习').length;
  const save = (next: Progress) => {
    setProgress(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); return true; }
    catch { setNotice('浏览器无法保存进度。当前会话仍可使用；离开前请导出备份。'); return false; }
  };
  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash); return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if(lastRoute.current===route)return;
    lastRoute.current=route;
    window.scrollTo({top:0});
    main.current?.focus({preventScroll:true});
  },[route]);
  useEffect(() => { document.title = chapter ? chapter.id + ' · ' + chapter.title + ' | 异常实验室' : '异常实验室 · Python 异常处理'; }, [chapter]);
  const visit = (id: string) => save({ ...progress, lastChapter: id });
  const mark = (id: string, key: 'read' | 'practice', value: boolean) => save({ ...progress, chapters: { ...progress.chapters, [id]: { read: progress.chapters[id]?.read ?? false, practice: progress.chapters[id]?.practice ?? false, [key]: value } } });
  const exportProgress = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(progress,null,2)],{type:'application/json'}));
    const link = document.createElement('a'); link.href = url; link.download = 'exception-lab-progress.json'; link.click(); URL.revokeObjectURL(url);
    setNotice('已发起进度文件下载。请保留 JSON 文件以便换浏览器时导入。');
  };
  return <div className="app" data-reduced-motion={systemReduced || progress.settings.reducedMotion}>
    <a className="skip" href="#main" onClick={e => { e.preventDefault(); main.current?.focus(); }}>跳转到正文</a>
    <header className="topbar"><a className="brand" href="#/home"><span className="brand-icon" aria-hidden="true">ex</span><span>异常实验室<small>PYTHON EXCEPTION LAB</small></span></a><a className="resource-link" href={pythonPackageUrl} download="python-course.zip">下载 Python 配套包 <span aria-hidden="true">↗</span></a></header>
    <div className="layout">
      <CourseNavigation route={route} progress={progress} onNavigate={id=>{if(id!=='home')visit(id);if(id===route)main.current?.focus({preventScroll:true});}}/>
      <main id="main" ref={main} tabIndex={-1}>
        {notice && <div className="notice" role="status">{notice}<button aria-label="关闭通知" onClick={() => setNotice('')}>×</button></div>}
        <div className="chapter-route" key={route}>
        {!chapter && route !== 'home' ? <section className="panel"><h1>没有找到这个章节</h1><p>当前链接不属于这套课程。</p><a href="#/home">回到课程总览</a></section> : chapter ? chapter.id === '02' ? <ChapterTwo key={chapter.id + recordRevision} chapter={chapter} scenarios={traces.filter(s=>s.chapter==='02')} progress={progress} reduced={systemReduced || progress.settings.reducedMotion} packageUrl={pythonPackageUrl} mark={mark} onAnswer={(id,correct,hint) => save(recordAnswer(progress,id,correct,hint))} visit={visit}/> : Guided ? <Guided key={chapter.id + recordRevision} chapter={chapter} scenarios={traces.filter(s=>s.chapter===chapter.id)} progress={progress} reduced={systemReduced || progress.settings.reducedMotion} packageUrl={pythonPackageUrl} mark={mark} onAnswer={(id,correct,hint) => save(recordAnswer(progress,id,correct,hint))} visit={visit}/> : <ChapterPage key={chapter.id + recordRevision} chapter={chapter} progress={progress} reduced={systemReduced || progress.settings.reducedMotion} mark={mark} onAnswer={(id,correct,hint) => save(recordAnswer(progress,id,correct,hint))} visit={visit}/> :
          <><div className="hero"><div className="eyebrow">一套可以动手验证的 PYTHON 课程</div><h1>读懂每一次异常，<br/><span>写出可靠的程序。</span></h1><p className="hero-description">从第一条 traceback 到并发任务的失败边界。先做预测，逐步看见执行过程，再用真实 Python 验证你的理解。</p><div className="button-row"><a className="primary button" href={'#/' + progress.lastChapter} onClick={() => visit(progress.lastChapter)}>继续学习 · 第 {progress.lastChapter} 章 <span aria-hidden="true">→</span></a><a className="button" href="#course-map" onClick={e => { e.preventDefault(); focusSection('course-map'); }}>查看学习路线</a></div><div className="hero-facts"><span><strong>{chapters.length}</strong> 个完整章节</span><span><strong>{traces.length}</strong> 个真实运行场景</span><span><strong>3.11+</strong> Python 语义基线</span></div><div className="hero-illustration" aria-hidden="true"><div className="diagram-label">FOLLOW THE EXECUTION</div><div className="diagram-node">读取一条任务</div><div className="diagram-line"/><div className="diagram-node dark">int("bad") <b>!</b></div><div className="diagram-branches"><span>捕获 · 恢复</span><span>传播 · 报告</span></div><div className="diagram-node">清理资源 → 下一步</div></div></div>
          <div className="dashboard-stats"><div><span>学习记录</span><strong>{completed} <small>/ {chapters.length}</small></strong><p>章节完成自测</p></div><div><span>复习线索</span><strong>{needsReview}</strong><p>章节有待巩固的知识点</p></div><div className="learning-note"><span>建议学习方式</span><p>每章预留一段不看答案的时间。网页完成预测与分析，本地 Python 完成编程练习。</p><a href={pythonPackageUrl} download="python-course.zip">取得案例、测试与参考解答 →</a></div></div>
          <section className="route-section" id="course-map"><div className="section-heading"><div><div className="eyebrow">YOUR LEARNING PATH</div><h2>从执行流程到程序设计</h2></div><label>筛选状态<select value={filter} onChange={e => setFilter(e.target.value)}>{['全部','未开始','已阅读','练习中','待复习','完成自测'].map(s => <option key={s}>{s}</option>)}</select></label></div><div className="course-grid">{chapters.filter(c => filter === '全部' || chapterStatus(c,progress) === filter).map(c => <a className="course-card" key={c.id} href={'#/' + c.id} onClick={() => visit(c.id)}><div className="card-top"><span className="card-number">{c.id}</span><span className={'badge ' + (c.level === '进阶' ? 'advanced' : '')}>{c.level}</span></div><h3>{c.title}</h3><p>{c.subtitle}</p><div className="card-bottom"><span>{c.minutes} 分钟 · {chapterStatus(c,progress)}</span><span aria-hidden="true">↗</span></div></a>)}</div>{!chapters.some(c => filter === '全部' || chapterStatus(c,progress) === filter) && <p className="empty">还没有符合此状态的章节。</p>}</section></>}
        </div>
        <section className="progress-tools" aria-label="本地学习记录"><details><summary>学习记录、掌握度规则与设置</summary><p>只保存在当前浏览器。无账号、无服务器，也没有跨设备同步。</p><p>“完成自测”要求：标记读完、按本地验收清单自评完成编程练习，且本章所有题最新一次独立答对。曾答错的题需要连续两次不看提示答对。它是复习线索，不代表经外部认证掌握。提示后的正确答案不计入独立作答。</p><div className="button-row"><button onClick={exportProgress}>导出进度</button><button onClick={() => file.current?.click()}>导入进度</button><input ref={file} type="file" accept=".json,application/json" className="sr-only" aria-label="选择进度 JSON 文件" onChange={async e => { const input = e.currentTarget; const selected = input.files?.[0]; if (!selected) return; try { if(selected.size > 1000000) throw new Error('文件不能超过 1 MB。'); const next = parseProgress(await selected.text(),chapters); const persisted = save(next); setRecordRevision(v => v + 1); setNotice(persisted ? '进度已导入并替换本地记录。' : '进度仅导入当前会话，浏览器无法保存；刷新会恢复旧记录，请导出备份。'); } catch (err) { setNotice('导入失败，原进度已保留：' + (err instanceof Error ? err.message : '格式无效')); } finally { input.value = ''; } }}/><button onClick={() => setResetPending(true)}>重置学习记录</button></div>{resetPending && <div className="reset-confirm" role="group" aria-label="确认重置"><p>这将清空当前浏览器的课程记录。需要保留时请先导出。</p><button onClick={() => { const persisted = save(emptyProgress()); setRecordRevision(v => v + 1); setResetPending(false); setNotice(persisted ? '本地学习记录已重置。' : '仅清空了当前会话记录，浏览器无法保存；刷新会恢复旧记录。'); }}>确认清空</button><button onClick={() => setResetPending(false)}>取消</button></div>}<label className="check-label"><input type="checkbox" checked={progress.settings.reducedMotion} onChange={e => save({...progress,settings:{reducedMotion:e.target.checked}})}/>减少动效（系统偏好同样生效）</label></details></section>
      </main>
    </div>
  </div>;
}
function ChapterPage({ chapter, progress, reduced, mark, onAnswer, visit }: {chapter: Chapter; progress: Progress; reduced: boolean; mark: (id:string,key:'read'|'practice',value:boolean)=>void; onAnswer:(id:string,correct:boolean,hint:boolean)=>void; visit:(id:string)=>void}) {
  const [practiceHints,setPracticeHints] = useState(0);
  const index = chapters.findIndex(c => c.id === chapter.id);
  const chapterTraces = traces.filter(s => s.chapter === chapter.id);
  return <>
    <div className="breadcrumb"><a href="#/home">学习路线</a><span>/</span><span>第 {chapter.id} 章</span><span className="badge">{chapter.level} · {chapter.minutes} 分钟</span></div>
    <header className="chapter-hero"><div className="eyebrow">CHAPTER {chapter.id} · {chapterStatus(chapter,progress)}</div><h1>{chapter.title}</h1><p>{chapter.subtitle}</p><blockquote>{chapter.hook}</blockquote></header>
    <div className="chapter-intro"><section><h2>这一章，你将能够</h2><ul>{chapter.outcomes.map(s => <li key={s}><Inline text={s}/></li>)}</ul></section><section><h2>先准备这些</h2><ul className="prereq-list">{chapter.prerequisites.map(s => <li key={s}>{chapters.some(c => c.id === s) ? <a href={'#/' + s} onClick={() => visit(s)} title={chapters.find(c => c.id === s)?.title}>第 {s} 章</a> : <Inline text={s}/>}</li>)}</ul></section></div>
    <nav className="toc" aria-label="本章目录"><span>本章导航</span>{chapter.sections.map(s => <a key={s.id} href={'#section-'+s.id} onClick={e => {e.preventDefault(); focusSection('section-'+s.id);}}>{s.title}</a>)}<a href="#lab" onClick={e=>{e.preventDefault();focusSection('lab');}}>交互实验</a><a href="#practice" onClick={e=>{e.preventDefault();focusSection('practice');}}>练习与测验</a></nav>
    <article className="lesson-text">{chapter.sections.map(section => <section id={'section-' + section.id} key={section.id}><h2>{section.title}</h2>{section.paragraphs.map((p,i) => <p key={i}><Inline text={p}/></p>)}{(section.code || examples[section.exampleId ?? '']) && <Code code={section.code ?? examples[section.exampleId ?? '']} label={section.exampleId ? 'Python · python/examples/' + section.exampleId + '.py' : '教学代码片段 · 结合本节上下文阅读'}/>} {section.bullets && <ul>{section.bullets.map(p => <li key={p}><Inline text={p}/></li>)}</ul>}</section>)}</article>
    <ConceptMap id={chapter.id}/>
    <TracePlayer key={chapter.id} scenarios={chapterTraces} reduced={reduced}/>
    <section className="misconceptions"><div className="eyebrow">CHECK YOUR MENTAL MODEL</div><h2>这些判断，值得再检查</h2><div>{chapter.misconceptions.map(m => <article key={m.myth}><h3>误解：{m.myth}</h3><p><Inline text={m.correction}/></p></article>)}</div></section>
    <section id="practice" className="practice-section"><div className="section-heading"><div><div className="eyebrow">PRACTICE & TRANSFER</div><h2>把理解放进新问题</h2></div><span>{chapter.quizzes.length} 道练习</span></div>{chapter.quizzes.map(q => <Quiz key={q.id} quiz={q} record={progress.answers[q.id]} onAnswer={(correct,hint) => onAnswer(q.id,correct,hint)}/>)}</section>
    <section className="local-practice"><div className="eyebrow">真实 PYTHON · 本地编程练习</div><h2>{chapter.practice.title}</h2><p><Inline text={chapter.practice.task}/></p><p>编辑文件：<code>{chapter.practice.file}</code></p><p>先下载并解压配套包，按包内 README 安装 pytest。在项目根目录运行下列测试；网页不会执行或自动评分你的代码。</p><Code code={chapter.practice.test} label="终端命令 · 以项目 Python 环境运行"/><div className="button-row"><a className="button" href={pythonPackageUrl} download="python-course.zip">下载配套项目与测试</a>{practiceHints < chapter.practice.hints.length && <button onClick={()=>setPracticeHints(practiceHints+1)}>查看编程提示 {practiceHints+1}</button>}</div>{practiceHints > 0 && <ol className="hint">{chapter.practice.hints.slice(0,practiceHints).map(h => <li key={h}><Inline text={h}/></li>)}</ol>}<details><summary>参考思路与实现（先自己完成）</summary><Code code={chapter.practice.solution}/></details><h3>独立验收清单</h3><ul>{chapter.practice.checklist.map(c=><li key={c}><Inline text={c}/></li>)}</ul><label className="check-label"><input type="checkbox" checked={progress.chapters[chapter.id]?.practice ?? false} onChange={e=>mark(chapter.id,'practice',e.target.checked)}/>我已在本地运行测试，并能按清单解释结果（自评）</label></section>
    <section className="project-connection"><div className="eyebrow">贯穿项目 · 可靠任务处理器</div><h2>把这一章接到项目中</h2><p><Inline text={chapter.project}/></p></section>
    <section className="recap"><h2>带走的执行模型</h2><ul>{chapter.recap.map(r=><li key={r}><Inline text={r}/></li>)}</ul><label className="check-label"><input type="checkbox" checked={progress.chapters[chapter.id]?.read ?? false} onChange={e=>mark(chapter.id,'read',e.target.checked)}/>已阅读并回顾本章</label></section>
    <details className="sources"><summary>官方资料与版本依据</summary><p>课程基线为 Python 3.11。下面链接需要网络；正文、实验与练习可离线学习。</p><ul>{chapter.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a></li>)}</ul></details>
    <nav className="chapter-pagination" aria-label="相邻章节">{chapters[index-1] ? <a href={'#/'+chapters[index-1].id} onClick={()=>visit(chapters[index-1].id)}>← 上一章<span>{chapters[index-1].title}</span></a> : <a href="#/home">← 课程总览</a>}{chapters[index+1] ? <a href={'#/'+chapters[index+1].id} onClick={()=>visit(chapters[index+1].id)}>下一章 →<span>{chapters[index+1].title}</span></a> : <a href="#/home">回到总览 →<span>检查复习线索</span></a>}</nav>
  </>;
}
