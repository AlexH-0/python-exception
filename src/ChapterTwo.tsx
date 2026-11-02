import { useRef, useState } from 'react';
import type { Chapter, Scenario } from './content/schema';
import type { Progress } from './progress';
import Code from './Code';
import Quiz from './Quiz';
import TracePlayer from './TracePlayer';
import { ChapterHeaderNavigation, LessonFooter } from './ChapterNavigation';
import './sample.css';

type Props = { chapter: Chapter; scenarios: Scenario[]; progress: Progress; reduced: boolean; packageUrl: string; mark: (id:string,key:'read'|'practice',value:boolean)=>void; onAnswer:(id:string,correct:boolean,hint:boolean)=>void; visit:(id:string)=>void };
const lessons = ['正常路径', '匹配顺序', '保护边界', '自己动手', '回顾'];
const titles = ['没有异常，会经过 except 吗？', 'KeyError 会被谁接住？', 'else 出错，还能回到 except 吗？', '只在缺少键时，使用默认值', '下次写 try 时，先想这三件事'];
const descriptions = ['先猜一下，再沿着代码走一遍。', '两个处理器都能匹配，但只有一个会执行。', '切换两次运行，对照异常发生的位置。', '把处理范围缩小到你确实能恢复的错误。', '处理什么、在哪里处理、处理后怎么办。'];

function Prediction({ question, options, answer, explanation }: {question:string;options:string[];answer:number;explanation:string}) {
  const [choice,setChoice] = useState<number|null>(null);
  return <div className="sample-prediction"><p className="sample-prompt">{question}</p><div className="sample-choices" role="group" aria-label={question}>{options.map((option,i)=><button key={option} aria-pressed={choice===i} onClick={()=>setChoice(i)}><span className="choice-letter">{String.fromCharCode(65+i)}</span>{option}</button>)}</div>{choice!==null && <p className={'sample-feedback '+(choice===answer?'correct':'rethink')} role="status"><strong>{choice===answer?'✓ 对，':'再看一下：'}</strong>{explanation}</p>}</div>;
}

function Tutor({scenario, event, children}: {scenario:Scenario; event:number; children?:React.ReactNode}) {
  const step=scenario.steps[event];
  return <div className="sample-tutor"><Code code={scenario.code} line={step?.line} label="Python 3.11 · 示例代码"/><div className="sample-observer">{children}<div className="sample-frame"><span className="sample-label">当前作用域 · 模块</span><dl><dt>mode</dt><dd><code>{step?.state.mode??'尚未赋值'}</code></dd></dl></div><div className="sample-console"><span className="sample-label">输出</span><pre aria-label="教学累计输出">{step?.output.join('\n')||'（尚无输出）'}</pre></div></div></div>;
}

function NormalPath({scenario}:{scenario:Scenario}) {
  const [node,setNode]=useState(-1);
  const events=scenario.steps.map((step,index)=>({step,index})).filter(({step})=>step.event==='output');
  const labels=['try','else','finally','done'];
  const notes=['先进入 try。这个输入不会触发 raise。','try 正常走到末尾，进入 else；跳过两个 except。','接着执行 finally 中的清理代码。','继续执行整个 try 语句之后的代码。'];
  return <><Prediction question="这次 mode = 'normal'，你预计走哪条路？" options={['try → else → finally → done','try → except → finally → done']} answer={0} explanation="try 没有抛出异常，因此跳过 except，进入 else。"/><Tutor scenario={scenario} event={node<0?-1:events[node].index}><div className="sample-flow" aria-label="正常执行路径">{labels.map((label,i)=><button key={label} aria-pressed={node===i} onClick={()=>setNode(i)}><span>{i+1}</span><code>{label}</code>{node===i&&<b>当前</b>}</button>)}</div><div className="sample-observation" role="status"><strong>{node<0?'先从 try 开始':`关键节点 ${node+1} / ${events.length}`}</strong><p>{node<0?'点下方按钮，或直接选择右侧的节点。':notes[node]}</p></div></Tutor><div className="sample-controls"><button disabled={node<0} onClick={()=>setNode(node-1)}>上个节点</button><button className="primary" disabled={node===events.length-1} onClick={()=>setNode(node+1)}>下个节点</button><button onClick={()=>setNode(-1)}>重走路径</button><small>高亮行的 print 已执行；输出随节点更新。</small></div><details className="sample-note"><summary>没有异常，就一定会进入 else 吗？</summary><p>还要正常走到 try 的末尾。若先执行了 return、break 或 continue，也不会进入 else。下一章会用实际代码看这些提前退出。</p></details></>;
}

function MatchPath({scenario}:{scenario:Scenario}) {
  const [chosen,setChosen]=useState<number|null>(null);
  const [show,setShow]=useState(false);
  const caught=scenario.steps.findIndex(s=>s.event==='output'&&s.output.includes('lookup handled'));
  const raised=scenario.steps.findIndex(s=>s.event==='exception');
  return <><div className="sample-match-intro"><span className="exception-token">抛出 KeyError('task')</span><span className="sample-inheritance"><code>KeyError</code> → <code>LookupError</code> → <code>Exception</code><small>沿箭头是父类</small></span></div><Tutor scenario={scenario} event={show?caught:raised}><div className="sample-handler-list" role="group" aria-label="选择先执行的处理器">{['LookupError','Exception'].map((type,i)=><button key={type} aria-pressed={chosen===i} onClick={()=>{setChosen(i);setShow(true);}} className={show&&i===0?'handler-caught':''}><span className="handler-order">0{i+1}</span><span><code>except {type}:</code><small>{show?(i===0?'✓ 首个匹配，执行这里':'跳过：已经处理完毕'):'点击预测：会进入这里吗？'}</small></span></button>)}</div>{show&&<p className="sample-feedback" role="status"><strong>{chosen===0?'✓ 判断正确。':'两个类型都能匹配，但顺序决定结果。'}</strong> Python 从上到下检查，在 LookupError 这里就停止寻找。</p>}</Tutor><div className="sample-controls"><button onClick={()=>{setChosen(null);setShow(false);}}>重新判断</button><small>{show?'高亮的是已经产生输出的处理器。':'高亮的是抛出异常的位置。'}</small></div><p className="sample-takeaway">把需要特殊处理的具体类型放前面，再放宽泛的兜底处理器。</p><details className="sample-note"><summary>几种错误采用同一种处理办法，怎么写？</summary><p>可以写 <code>except (KeyError, IndexError):</code>。只有恢复动作相同时才合并；缺少可选文件可以用默认值，权限不足通常需要报告。</p></details></>;
}

function Boundary({normal,error}:{normal:Scenario;error:Scenario}) {
  const [mode,setMode]=useState<'normal'|'error'>('normal');
  const [revealed,setRevealed]=useState(false);
  const scene=mode==='normal'?normal:error;
  return <><div className="sample-segment" role="group" aria-label="对照运行"><button aria-pressed={mode==='normal'} onClick={()=>{setMode('normal');setRevealed(false);}}>正常结束</button><button aria-pressed={mode==='error'} onClick={()=>{setMode('error');setRevealed(false);}}>在 else 中抛错</button></div><div className="sample-boundary"><div className="protected-scope"><span className="sample-label">这组 except 的保护范围</span><strong>try 内的操作</strong><span>发生异常 → 从上到下寻找匹配项</span></div><div className={'outside-scope '+(mode==='error'?'scope-error':'')}><span className="sample-label">保护范围之外</span><strong>else 内的操作</strong><span>{mode==='normal'?'继续 → finally → done':'ValueError → finally → 向外传播'}</span></div></div><p className="sample-takeaway">{mode==='normal'?'try 正常完成后，才开始执行 else。':'else 的新异常不会回到同一组 except。finally 仍会执行。'}</p><button className="primary" onClick={()=>setRevealed(!revealed)} aria-expanded={revealed}>{revealed?'收起运行结果':'查看这次运行'}</button>{revealed&&<div className="sample-comparison"><Tutor scenario={scene} event={scene.steps.length-1}/><div className="sample-feedback" role="status">{scene.exception?<><strong>向外传播：{scene.exception}</strong><p>输出停在 finally，没有执行最后一行的 done。</p></>:<><strong>这次没有未捕获异常。</strong><p>输出以 done 结束。</p></>}</div><p className="sample-caption">显示退出时的真实状态；高亮为最后一个追踪事件所在行，不表示再次执行该行。</p></div>}</>;
}

function Practice({chapter,progress,onAnswer,mark,packageUrl}:Pick<Props,'chapter'|'progress'|'onAnswer'|'mark'|'packageUrl'>) {
  const [question,setQuestion]=useState(0);
  const [hints,setHints]=useState(0);
  const quiz=chapter.quizzes[question];
  return <><nav className="sample-question-nav" aria-label="练习题目">{chapter.quizzes.map((q,i)=><button key={q.id} aria-label={`第 ${i+1} 题`} aria-current={question===i?'step':undefined} onClick={()=>setQuestion(i)}>第 {i+1} 题{progress.answers[q.id]?.lastCorrect?' ✓':''}</button>)}</nav><Quiz key={quiz.id} quiz={quiz} record={progress.answers[quiz.id]} onAnswer={(correct,hint)=>onAnswer(quiz.id,correct,hint)}/><details className="sample-note"><summary>EAFP 与 LBYL：先试，还是先检查？</summary><div className="sample-methods"><div><strong>EAFP · 先尝试</strong><p>Easier to ask forgiveness than permission：先尝试操作，捕获预期异常。这里直接读取 mapping[key]，只对 KeyError 给默认值。</p></div><div><strong>LBYL · 先检查</strong><p>Look before you leap：操作前先检查条件。比如先判断 key 是否存在，再读取；检查后状态可能变化时，仍需考虑操作失败。</p></div></div><p>如果 None 本身也是合法值，就不能只看 mapping.get(key) 的返回值判断是否缺键。</p></details><details className="sample-note"><summary>本地编程练习 · 只对缺失键使用默认值</summary><p>{chapter.practice.task}</p><p>编辑 <code>{chapter.practice.file}</code>。网页不运行或自动评分这道代码题。</p><a className="button" href={packageUrl} download="python-course.zip">下载配套项目与测试</a><p>解压后按 README 安装 Python 和 pytest，再运行：</p><Code code={'# Windows PowerShell\n$env:COURSE_IMPL = "exercises"\n.venv/Scripts/python.exe -m pytest tests/python/test_exercises.py -k ch02\nRemove-Item Env:COURSE_IMPL\n\n# macOS / Linux\nCOURSE_IMPL=exercises .venv/bin/python -m pytest tests/python/test_exercises.py -k ch02'} label="终端 · 在配套包根目录运行"/><button disabled={hints>=chapter.practice.hints.length} onClick={()=>setHints(hints+1)}>查看编程提示</button>{hints>0&&<ul>{chapter.practice.hints.slice(0,hints).map(h=><li key={h}>{h}</li>)}</ul>}<details><summary>参考实现</summary><Code code={chapter.practice.solution}/></details><ul>{chapter.practice.checklist.map(c=><li key={c}>{c}</li>)}</ul><label className="check-label"><input type="checkbox" checked={progress.chapters['02']?.practice??false} onChange={e=>mark('02','practice',e.target.checked)}/>我已在本地运行测试，并能按清单解释结果（自评）</label></details></>;
}

export default function ChapterTwo({chapter,scenarios,progress,reduced,packageUrl,mark,onAnswer,visit}:Props) {
  const [screen,setScreen]=useState(0);
  const [free,setFree]=useState(false);
  const heading=useRef<HTMLHeadingElement>(null);
  const normal=scenarios.find(s=>s.id==='02-match-normal')!;
  const error=scenarios.find(s=>s.id==='02-match-error')!;
  const elseError=scenarios.find(s=>s.id==='02-match-else-error')!;
  const go=(next:number,lab=false)=>{setScreen(next);setFree(lab);requestAnimationFrame(()=>{heading.current?.focus({preventScroll:true});heading.current?.scrollIntoView({block:'start'});});};
  return <div className="sample-chapter chapter-02">
    <ChapterHeaderNavigation chapter={chapter} visit={visit}/>
    <header className="sample-hero"><div><h1>{chapter.title}</h1><p>顺着一段代码，弄清程序会走哪条路。</p></div><span className="sample-edition">PYTHON<br/><b>3.11+</b></span></header>
    <nav className="sample-nav" aria-label="本章导航">{lessons.map((name,i)=><button key={name} aria-current={!free&&screen===i?'step':undefined} onClick={()=>go(i)}><span>0{i+1}</span> {name}</button>)}<button className="sample-free-link" aria-current={free?'page':undefined} onClick={()=>go(screen,true)}>自由实验</button></nav>
    <section key={free?'free':screen} className="sample-stage" aria-labelledby="sample-heading"><div className="sample-screen-heading"><span className="sample-label">{free?'运行记录':`第 ${screen+1} 节 / ${lessons.length}`}</span><h2 id="sample-heading" ref={heading} tabIndex={-1}>{free?'换个场景，再观察一次':titles[screen]}</h2><p>{free?'选择场景，逐步查看运行记录。编程练习在本地完成。':descriptions[screen]}</p></div>
    {free?<><p className="sample-caption">逐行事件显示执行前状态；“产生输出”事件显示打印后的状态。</p><TracePlayer scenarios={scenarios} reduced={reduced} cards/></>:<div key={screen} className="sample-content">
      {screen===0&&<NormalPath scenario={normal}/>}
      {screen===1&&<MatchPath scenario={error}/>}
      {screen===2&&<Boundary normal={normal} error={elseError}/>}
      {screen===3&&<Practice chapter={chapter} progress={progress} onAnswer={onAnswer} mark={mark} packageUrl={packageUrl}/>}
      {screen===4&&<><div className="sample-recap-grid">{['先看类型','再看顺序','最后看范围'].map((label,i)=><div key={label}><span>0{i+1}</span><h3>{label}</h3><p>{['子类可以由父类处理器捕获。选择你有能力恢复的错误。','从上到下，只执行第一个匹配的 except。具体类型放在前面。','同组 except 处理 try 内的异常；else 中的新异常向外传播。'][i]}</p></div>)}</div><details className="sample-note"><summary>还有一个容易忘的细节：as err</summary><p><code>except SomeError as err</code> 中的 err 是临时名称，离开处理器时会被清除。异常可能通过 traceback 引用帧和局部变量，清理名字有助于避免引用循环。要保留诊断信息，可以在块内保存消息或必要字段，别依赖块外的 err。</p></details><div className="sample-project"><span className="sample-label">用到任务处理器里</span><p>{chapter.project}</p></div><label className="check-label"><input type="checkbox" checked={progress.chapters['02']?.read??false} onChange={e=>mark('02','read',e.target.checked)}/>已阅读并回顾本章</label><details className="sample-note"><summary>先修知识、学习目标与资料</summary><p>先修：<a href="#/01" onClick={()=>visit('01')}>第一章：认识异常与 traceback</a></p><ul>{chapter.outcomes.map(o=><li key={o}>{o}</li>)}</ul><p>Python 3.11 基线；外部资料需要联网。</p><ul>{chapter.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul></details></>}
    </div>}
    </section>
    <LessonFooter chapter={chapter} screen={screen} free={free} count={lessons.length} go={go} visit={visit}/>
  </div>;
}
