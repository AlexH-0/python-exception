import { useState } from 'react';
import type { Scenario } from './content/schema';
import Code from './Code';
import GuidedChapter, { TraceEvidence, type GuidedProps } from './GuidedChapter';

const modes=[{id:'keep',name:'只做清理',result:'4',note:'finally 正常结束，原返回值交给调用者。'},{id:'replace',name:'改成 return 9',result:'9',note:'finally 的新 return 覆盖原返回值，调用者得到 9。'},{id:'fail',name:'清理时抛错',result:'OSError',note:'finally 抛出异常，返回流程中止，调用者收不到 4。'}];

function ReturnDesk({scenarios}:{scenarios:Scenario[]}) {
  const [mode,setMode]=useState(0);
  const [phase,setPhase]=useState(0);
  const selected=modes[mode];
  const scene=scenarios.find(s=>s.id===`03-result-${selected.id}`)!;
  const cleanup=scene.steps.findIndex(s=>s.event==='output'&&s.output[0]==='cleanup');
  const ready=scene.steps.findIndex(s=>s.event==='line'&&s.line===5);
  const finalEvent=scene.exception?scene.steps.findIndex(s=>s.event==='exception'):scene.steps.reduce((last,s,i)=>s.event==='output'?i:last,-1);
  const event=[ready,cleanup,finalEvent][phase];
  return <>
    <div className="sample-segment" role="group" aria-label="清理策略">{modes.map((m,i)=><button key={m.id} aria-pressed={mode===i} onClick={()=>{setMode(i);setPhase(0);}}>{m.name}</button>)}</div>
    <div className="return-workbench">
      <div className="return-route" aria-label="结果交付过程">
        <div className={'result-ticket '+(phase===2&&mode!==0?'ticket-replaced':'')}><span className="sample-label">try 暂存的返回值</span><strong>4</strong><span>{phase===2?(mode===0?'原值已交付':'原值未交付'):'还没交给调用者'}</span></div>
        <span className="route-arrow" aria-hidden="true">→</span>
        <div className={'cleanup-gate '+(phase===1?'gate-active':'')}><span className="sample-label">先经过 finally</span><strong>清理</strong><span>{phase===0?'即将执行':phase===1?'cleanup 已输出':'本次清理已结束'}</span></div>
        <span className="route-arrow" aria-hidden="true">→</span>
        <div className={'result-ticket received '+(phase===2&&mode===2?'ticket-error':'')}><span className="sample-label">调用者收到</span><strong>{phase===2?selected.result:'…'}</strong><span>{phase===2?(mode===2?'异常继续传播':'函数返回'):'等待清理完成'}</span></div>
      </div>
      <div className="sample-controls"><button disabled={phase===0} onClick={()=>setPhase(phase-1)}>退一步</button><button className="primary" disabled={phase===2} onClick={()=>setPhase(phase+1)}>{phase===0?'执行清理':'交付结果'}</button><button onClick={()=>setPhase(0)}>重新观察</button></div>
      <p className="mechanism-status" role="status">{phase===0?'return 4 已经求值，但还没返回。现在准备执行 finally。':phase===1?'cleanup 已经打印。继续看调用者最终会收到什么。':selected.note}</p>
    </div>
    <div className="compact-code-output"><Code code={scene.code} line={scene.steps[event].line} label="Python 3.11 · 当前策略的真实脚本"/><div className="sample-console"><span className="sample-label">当前输出</span><pre aria-label="当前输出">{scene.steps[event].output.join('\n')||'（尚无输出）'}</pre></div></div>
    <p className="sample-caption">高亮是当前真实事件：开始时指向即将执行的清理行；打印事件显示执行后的输出，异常事件标出抛错位置。</p>
    <details className="sample-note"><summary>这里的“暂存”是什么意思？</summary><p>return 后的表达式先求值，结果要等 finally 正常结束才交给调用者。图中的卡片只是这个过程的教学表示，不是 Python 对象内存布局。</p></details>
  </>;
}

function LoopLanes({scenarios}:{scenarios:Scenario[]}) {
  const [mode,setMode]=useState('break');
  const scene=scenarios.find(s=>s.id===`03-finally-${mode}`)!;
  const outputs=scene.steps.filter(s=>s.event==='output');
  const rows=[0,1];
  return <>
    <div className="sample-segment" role="group" aria-label="循环退出方式">{['normal','break','continue'].map(m=><button key={m} aria-pressed={mode===m} onClick={()=>setMode(m)}>{m==='normal'?'正常走完':m}</button>)}</div>
    <div className="loop-map"><div className="loop-map-head"><span>轮次</span><span>try</span><span>finally</span><span>循环尾部</span></div>{rows.map(i=>{
      const started=outputs.some(s=>s.output.at(-1)===`try ${i}`);
      const clean=outputs.some(s=>s.output.at(-1)===`cleanup ${i}`);
      const tail=outputs.some(s=>s.output.at(-1)===`loop tail ${i}`);
      return <div className="loop-map-row" key={i}><span className="loop-index">{i+1}<small>index = {i}</small></span>{[[started,'进入'],[clean,'清理'],[tail,'执行']].map(([yes,label],j)=><span key={j} className={yes?'lane-done':'lane-skipped'}>{yes?'✓ '+label:'— 未执行'}</span>)}</div>;
    })}</div>
    <p className="sample-takeaway" role="status">{mode==='break'?'break 先经过 finally，再离开循环；第二轮不会开始。':mode==='continue'?'continue 先经过 finally，再进入下一轮；本轮尾部被跳过。':'正常路径每轮都经过 try、finally 和循环尾部。'}</p>
    <TraceEvidence scenario={scene} label="本次运行输出"/>
    <details className="sample-note"><summary>finally 真的在任何情况下都执行吗？</summary><p>这里讨论的是正常的 Python 控制流。强制结束进程、断电等情形无法保证清理。手动获取的资源应及时释放；文件等资源通常优先用 with 管理。</p></details>
  </>;
}

function ErrorExit({scenarios}:{scenarios:Scenario[]}) {
  const [choice,setChoice]=useState<'propagate'|'replace'|'swallow'>('propagate');
  const id=choice==='propagate'?'03-finally-error':choice==='replace'?'03-error-replace':'03-finally-return-override';
  const scene=scenarios.find(s=>s.id===id)!;
  return <>
    <div className="error-options" role="group" aria-label="异常路径的清理动作">{[{id:'propagate',name:'清理后正常结束',caption:'保留原异常'},{id:'replace',name:'清理又抛异常',caption:'新异常向外传播'},{id:'swallow',name:'清理里写 return',caption:'待传播异常被压掉'}].map(o=><button key={o.id} aria-pressed={choice===o.id} onClick={()=>setChoice(o.id as typeof choice)}><strong>{o.name}</strong><span>{o.caption}</span></button>)}</div>
    <div className="exception-handoff"><div><span className="sample-label">最初发生</span><code>ValueError</code></div><span aria-hidden="true">→</span><div><span className="sample-label">执行 finally 后</span><code>{choice==='propagate'?'ValueError':choice==='replace'?'RuntimeError':'return "overridden"'}</code></div></div>
    <p className="mechanism-status" role="status">{choice==='propagate'?'清理完成，原来的 ValueError 继续向外传播。':choice==='replace'?'调用者收到 RuntimeError；原 ValueError 留在新异常的 __context__ 中。':'调用者收到返回值，原 ValueError 不再传播。清理看似成功，却隐藏了失败。'}</p>
    <div className={'outcome-strip '+(scene.exception?'outcome-error':'outcome-warning')}><span>{scene.exception?'最终未捕获异常':'最终返回'}</span><strong>{scene.exception??scene.output.at(-1)}</strong></div>
    <TraceEvidence scenario={scene} label="本次运行输出"/>
    <p className="sample-caption">覆盖与吞错是危险反例。让 finally 专心收尾，业务返回留在正常流程中。</p>
  </>;
}

export default function ChapterThree(props:GuidedProps) {
  const names:Record<string,string>={normal:'正常结束',error:'原异常继续传播',return:'提前返回',break:'退出循环',continue:'继续下一轮',override:'清理抛错','return-override':'清理返回，吞掉异常'};
  const free=props.scenarios.filter(s=>props.chapter.scenarioIds.includes(s.id)).map(s=>({...s,title:names[s.id.replace('03-finally-','')]??s.title}));
  return <GuidedChapter {...props} scenarios={free} subtitle="先收尾，再离开。问题是：离开时带走的还是原结果吗？" lessons={[
    {label:'返回与清理',title:'已经 return 了，为什么还没返回？',intro:'换一种清理策略，看同一个返回值最终去了哪里。',content:<ReturnDesk scenarios={props.scenarios}/>},
    {label:'循环出口',title:'break 和 continue，能绕过清理吗？',intro:'同样循环两次，观察哪些格子真的执行了。',content:<LoopLanes scenarios={props.scenarios}/>},
    {label:'异常覆盖',title:'清理也失败，哪个错误会留下？',intro:'改动 finally 的退出方式，对照调用者看到的结果。',content:<ErrorExit scenarios={props.scenarios}/>},
  ]} recap={<><div className="sample-recap-grid">{[['先清理','正常结束、准备返回、跳出循环或异常传播，都要先经过 finally。'],['再交付','finally 正常结束，就继续原来的返回或传播；新 return 或异常可能改写它。'],['保持简单','清理代码少做决定，避免 return；文件等资源优先考虑 with。']].map(([title,text],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div><details className="sample-note"><summary>别把 else 和 finally 混在一起</summary><p>else 要求 try 完整正常结束，没有异常，也没有 return、break 或 continue 提前离开。finally 则在上述退出路径上执行收尾。</p></details></>}/>;
}
