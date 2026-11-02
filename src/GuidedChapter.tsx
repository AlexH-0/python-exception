import { useRef, useState, type ReactNode } from 'react';
import type { Chapter, Scenario } from './content/schema';
import { chapters } from './content/chapters';
import type { Progress } from './progress';
import Code from './Code';
import Quiz from './Quiz';
import TracePlayer from './TracePlayer';
import { ChapterHeaderNavigation, LessonFooter } from './ChapterNavigation';
import './sample.css';
import './mechanisms.css';

export type GuidedProps = {
  chapter: Chapter; scenarios: Scenario[]; progress: Progress; reduced: boolean; packageUrl: string;
  mark: (id:string,key:'read'|'practice',value:boolean)=>void;
  onAnswer: (id:string,correct:boolean,hint:boolean)=>void;
  visit: (id:string)=>void;
};
export type Lesson = { label:string; title:string; intro:string; content:ReactNode };

function Practice({chapter,progress,onAnswer,mark,packageUrl}:GuidedProps) {
  const [index,setIndex]=useState(0);
  const [hints,setHints]=useState(0);
  const quiz=chapter.quizzes[index];
  return <>
    <nav className="sample-question-nav" aria-label="练习题目">{chapter.quizzes.map((q,i)=><button key={q.id} aria-label={`第 ${i+1} 题`} aria-current={index===i?'step':undefined} onClick={()=>setIndex(i)}>第 {i+1} 题{progress.answers[q.id]?.lastCorrect?' ✓':''}</button>)}</nav>
    <Quiz key={quiz.id} quiz={quiz} record={progress.answers[quiz.id]} onAnswer={(correct,hint)=>onAnswer(quiz.id,correct,hint)}/>
    <details className="sample-note"><summary>本地编程 · {chapter.practice.title}</summary>
      <p>{chapter.practice.task}</p><p>编辑 <code>{chapter.practice.file}</code>。网页不运行这道代码题，请在本地验证。</p>
      <a className="button" href={packageUrl} download="python-course.zip">下载配套项目与测试</a>
      <p>先按包内 README 建立 Python 环境，再在解压目录运行：</p>
      <Code code={`# Windows PowerShell\n$env:COURSE_IMPL = 'exercises'\n.venv/Scripts/python.exe -m pytest tests/python/test_exercises.py -k ch${chapter.id}\nRemove-Item Env:COURSE_IMPL\n\n# macOS / Linux\nCOURSE_IMPL=exercises .venv/bin/python -m pytest tests/python/test_exercises.py -k ch${chapter.id}`} label="终端 · 测试自己的实现"/>
      <button disabled={hints>=chapter.practice.hints.length} onClick={()=>setHints(hints+1)}>查看编程提示</button>
      {hints>0&&<ul>{chapter.practice.hints.slice(0,hints).map(h=><li key={h}>{h}</li>)}</ul>}
      <details><summary>参考实现（先自己写）</summary><Code code={chapter.practice.solution}/></details>
      <ul>{chapter.practice.checklist.map(c=><li key={c}>{c}</li>)}</ul>
      <label className="check-label"><input type="checkbox" checked={progress.chapters[chapter.id]?.practice??false} onChange={e=>mark(chapter.id,'practice',e.target.checked)}/>我已在本地运行测试，并能按清单解释结果（自评）</label>
    </details>
  </>;
}

export function TraceEvidence({scenario,event,label='当前输出'}:{scenario:Scenario;event?:number;label?:string}) {
  const step=event===undefined?undefined:scenario.steps[event];
  return <div className="mechanism-evidence">
    <div className="sample-console"><span className="sample-label">{label}</span><pre aria-label={label}>{(event===undefined?scenario.output:step?.output)?.join('\n')||'（尚无输出）'}</pre></div>
    <details className="sample-note"><summary>查看对应代码</summary><Code code={scenario.code} line={step?.line} label={`Python ${scenario.pythonVersion} · ${scenario.id}`}/><p className="sample-caption">{event===undefined?'显示本次运行的最终输出。':'高亮对应当前轨迹事件；line 是执行前，output 是打印后。'} 可在自由实验查看更细的过程。</p></details>
  </div>;
}

export default function GuidedChapter(props:GuidedProps & {lessons:Lesson[]; recap:ReactNode; subtitle:string}) {
  const {chapter,scenarios,reduced,lessons,recap,subtitle,progress,mark,visit}=props;
  const [screen,setScreen]=useState(0);
  const [free,setFree]=useState(false);
  const heading=useRef<HTMLHeadingElement>(null);
  const labels=[...lessons.map(l=>l.label),'自己动手','回顾'];
  const titles=[...lessons.map(l=>l.title),'把理解放进一段新代码','带走这个执行模型'];
  const intros=[...lessons.map(l=>l.intro),'先判断，再用本地练习检验自己的实现。','带走关键规则，再把它们用到自己的程序里。'];
  const go=(next:number,lab=false)=>{setScreen(next);setFree(lab);requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});});};
  return <div className={`sample-chapter mechanism-chapter chapter-${chapter.id}`}>
    <ChapterHeaderNavigation chapter={chapter} visit={visit}/>
    <header className="sample-hero"><div><h1>{chapter.title}</h1><p>{subtitle}</p></div><span className="sample-edition">PYTHON<br/><b>3.11+</b></span></header>
    <nav className="sample-nav" aria-label="本章导航">{labels.map((label,i)=><button key={label} aria-current={!free&&screen===i?'step':undefined} onClick={()=>go(i)}><span>0{i+1}</span> {label}</button>)}<button className="sample-free-link" aria-current={free?'page':undefined} onClick={()=>go(screen,true)}>自由实验</button></nav>
    <section key={free?'free':screen} className="sample-stage" aria-labelledby="mechanism-heading">
      <div className="sample-screen-heading"><span className="sample-label">{free?'运行记录':`第 ${screen+1} 节 / ${labels.length}`}</span><h2 id="mechanism-heading" ref={heading} tabIndex={-1}>{free?'换个场景，再观察一次':titles[screen]}</h2><p>{free?'选择场景，逐步查看运行记录。编程练习在本地完成。':intros[screen]}</p></div>
      {free?<><p className="sample-caption">逐行事件显示执行前状态；“产生输出”事件显示打印后的状态。</p><TracePlayer scenarios={scenarios} reduced={reduced} cards/></>:<div key={screen} className="sample-content">
        {screen<lessons.length?lessons[screen].content:screen===lessons.length?<Practice {...props}/>:<>
          {recap}
          <div className="sample-project"><span className="sample-label">用到任务处理器里</span><p>{chapter.project}</p></div>
          <label className="check-label"><input type="checkbox" checked={progress.chapters[chapter.id]?.read??false} onChange={e=>mark(chapter.id,'read',e.target.checked)}/>已阅读并回顾本章</label>
          <details className="sample-note"><summary>先修、目标与资料</summary><p>先修：{chapter.prerequisites.map(id=>chapters.some(c=>c.id===id)?<a key={id} href={'#/'+id} onClick={()=>visit(id)}>第 {id} 章　</a>:<span key={id}>{id}；</span>)}</p><ul>{chapter.outcomes.map(o=><li key={o}>{o}</li>)}</ul><p>教学基线为Python3.11。下面的官方资料需要联网。</p><ul>{chapter.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul></details>
        </>}
      </div>}
    </section>
    <LessonFooter chapter={chapter} screen={screen} free={free} count={labels.length} go={go} visit={visit}/>
  </div>;
}
