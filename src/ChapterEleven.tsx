import { useState } from 'react';
import Code from './Code';
import GuidedChapter, { type GuidedProps } from './GuidedChapter';
import data from './data/concurrency.json';
import './concurrency.css';

type Tree = {type:string;message:string;children?:Tree[]};
function Node({tree}:{tree:Tree}) {
  return <li><div className={tree.children?'concurrent-group-node':'concurrent-leaf'}><strong>{tree.type}</strong><span>{tree.message}</span></div>{tree.children&&<ul>{tree.children.map((child,i)=><Node key={i} tree={child}/>)}</ul>}</li>;
}
function TreeView({tree,label}:{tree:Tree|null;label:string}) {
  return <div className="concurrent-tree"><span className="sample-label">{label}</span>{tree?<ul aria-label={label}><Node tree={tree}/></ul>:<p className="concurrent-no-tree">None · 没有这一部分</p>}</div>;
}
function Script({code}:{code:string}) {
  return <details className="sample-note"><summary>查看对应的完整 Python 脚本</summary><Code code={code}/></details>;
}
function Output({events}:{events:string[]}) {
  return <details className="sample-note"><summary>查看实际事件记录</summary><pre className="concurrent-events">{events.join('\n')}</pre></details>;
}

function SplitTree() {
  const [type,setType]=useState('ValueError');
  const [part,setPart]=useState<'matched'|'remainder'>('matched');
  const item=data.split.cases.find(c=>c.id===type)!;
  return <>
    <div className="concurrent-picker" role="group" aria-label="选择拆分的异常类型">{data.split.cases.map(c=><button key={c.id} aria-pressed={type===c.id} onClick={()=>setType(c.id)}>{c.id}</button>)}</div>
    <p className="concurrent-prompt"><code>matched, rest = original.split({type})</code>。切换右侧，观察叶子去了哪里。</p>
    <div className="concurrent-split"><TreeView tree={data.split.original} label="原组 · 保持不变"/><div className="concurrent-result-tree"><div className="concurrent-tabs" role="group" aria-label="选择拆分结果"><button aria-pressed={part==='matched'} onClick={()=>setPart('matched')}>匹配部分</button><button aria-pressed={part==='remainder'} onClick={()=>setPart('remainder')}>剩余部分</button></div><TreeView tree={item[part] as Tree|null} label={part==='matched'?'matched':'rest'}/></div></div>
    <p className="concurrent-explanation" role="status">{type==='Exception'?'Exception 也匹配外层组对象，因此整棵树进入匹配部分，剩余部分为 None。':part==='matched'?`按 ${type} 匹配叶子，相关的 outer / inner 嵌套路径仍保留。匹配结果仍是异常组。`:'没有匹配的叶子留在剩余组，嵌套路径也保留；拆分没有把原树展平或删改。'}</p>
    <details className="sample-note"><summary>ExceptionGroup 和 BaseExceptionGroup 的边界</summary><p>ExceptionGroup 只能包含 Exception 体系中的异常。BaseExceptionGroup 还可以容纳 KeyboardInterrupt 等 BaseException；若它的全部成员都属于 Exception，构造时会得到 ExceptionGroup。</p><p>普通 except Exception 不会捕获含有控制异常的 BaseExceptionGroup。不要为了“一网打尽”就把停止请求当作普通任务失败。</p></details>
    <Script code={data.split.code}/>
  </>;
}

function StarBranches() {
  const [selected,setSelected]=useState('residual');
  const item=data.routes.find(c=>c.id===selected)!;
  return <>
    <div className="concurrent-picker" role="group" aria-label="选择异常组处理方式">{data.routes.map(c=><button key={c.id} aria-pressed={selected===c.id} onClick={()=>setSelected(c.id)}>{c.label}</button>)}</div>
    <div className="star-routing"><div className="star-handled"><span className="sample-label">处理器收到的匹配部分</span>{item.handled.length?item.handled.map((h,i)=><div key={i}><h3>except* {h.type}</h3><TreeView tree={h.tree} label={`分支 ${i+1} 的子组`}/></div>):<p>没有进入 except ValueError。抛出的是组对象，不是一个 ValueError。</p>}</div><div className="star-remainder"><span className="sample-label">继续到达外层的部分</span><TreeView tree={item.remainder as Tree|null} label="外层观察到的组"/></div></div>
    <p className="concurrent-explanation" role="status">{selected==='ordinary'?'普通 except ValueError 按抛出的组对象匹配，不会自动深入挑选叶子。外层 except ExceptionGroup 收到原组。':selected==='all'?'两个 except* 分支都会运行，各自收到匹配子组；没有剩余异常继续传播。':selected==='nested'?'ValueError 与 TypeError 分别进入两个分支，inner 路径仍在；未匹配的 KeyError 随剩余组到达外层。':'ValueError 已由分支处理；KeyError 没有消失，随剩余组继续传播。'}</p>
    <details className="sample-note"><summary>except* 和多条 except 有什么不同？</summary><p>except* 会继续检查尚未处理的成员，所以同一个 try 后可以执行多个分支；每个叶子最多匹配其中一个分支，顺序仍然重要。</p><p>同一个 try 不能混用 except 与 except*。如本例需要在外层观察剩余组，应再套一层 try。except* 处理器中不能直接用 return、break 或 continue 离开处理结构。</p><p>处理器若重新抛出或抛出新异常，还会影响最终传播的组；本节先聚焦匹配与残留，不穷举合并规则。</p></details>
    <Output events={item.events}/><Script code={item.code}/>
  </>;
}

const cancelLabels:Record<string,string>={'worker started':'任务已开始并等待','cancel requested':'调用者请求取消','cancellation swallowed':'错误副本吞掉取消','cleanup':'执行必要清理','caller received cancellation':'调用者收到取消','caller received value':'调用者收到成功值'};
function Cancellation() {
  const [mode,setMode]=useState<'normal'|'counter'>('normal');
  const [positions,setPositions]=useState({normal:0,counter:0});
  const item=data.cancel.find(c=>c.id===mode)!;
  const step=positions[mode];
  const done=step===item.events.length;
  const setStep=(next:number)=>setPositions(old=>({...old,[mode]:next}));
  return <>
    <div className={'cancel-lab '+(mode==='counter'?'cancel-counterexample':'')}>
      <div className="cancel-lab-title"><span className="sample-label">取消是停止请求 · 不是自动重试的普通失败</span><strong className="cancel-mode">{mode==='normal'?'正常实验':'反例模式 · 吞掉取消'}</strong></div>
      <p className="concurrent-prompt">{mode==='normal'?<>CancelledError 继承 BaseException，<code>except Exception</code> 不会接住它。</>:<>错误副本捕获 <code>CancelledError</code> 后返回 <code>"pretend success"</code>。</>}</p>
      <ol className="cancel-stops" aria-label="取消的真实事件路径">{item.events.map((event,i)=><li key={i} className={i<step?'cancel-stop-seen':''} aria-current={i===step-1?'step':undefined}><span>{i<step?'✓':i+1}</span><strong>{cancelLabels[event]||event}</strong><small>{i<step?'已观察':'尚未展示'}</small></li>)}</ol>
      <div className="cancel-outcome" aria-live="polite"><span className="sample-label">外层 await 的实际结果</span>{done?<><h3>{item.cancelled?'取消继续传播':`正常返回 ${item.returned}`}</h3><p>task.cancelled() = <code>{item.cancelled?'True':'False'}</code> · 清理 {item.cleaned?'已执行':'未执行'}</p><p>{item.cancelled?'finally 清理后，取消仍然交给调用者。':'任务虽然被请求取消，却被错误副本报告为正常返回；清理执行不等于取消语义正确。'}</p></>:<p>先观察到最后一个事件，再查看最终状态。本例 cancel() 发出请求时，task.cancelled() 并不会立刻变成 True。</p>}</div>
      <div className="concurrent-actions"><button disabled={step===0} onClick={()=>setStep(step-1)}>上一个取消事件</button><button className="primary" disabled={done} onClick={()=>setStep(step+1)}>下一个取消事件</button></div>
      <details className="cancel-switch"><summary>试试错误写法：捕获取消后返回成功值</summary><p>错误副本会有限结束，不留下后台任务；两种模式分别记住观察位置。</p><label><input type="checkbox" checked={mode==='counter'} onChange={e=>setMode(e.target.checked?'counter':'normal')}/>进入错误副本：吞掉 CancelledError</label></details>
      <button className="concurrent-reset" onClick={()=>{setMode('normal');setPositions({normal:0,counter:0});}}>重置两份取消实验</button>
    </div>
    <details className="sample-note"><summary>推荐比较顺序</summary><ol><li>正常模式观察到末尾：清理执行，调用者收到取消。</li><li>展开并开启错误副本：同样清理，却返回成功值。</li><li>关闭副本：正常模式恢复到上次位置。比较最终 cancelled 状态，别只检查有没有执行 finally。</li></ol></details>
    <details className="sample-note"><summary>await、任务和取消要分清什么？</summary><p>调用 async 函数只创建协程对象；await 等待可等待对象；直接 await 协程时，会运行该协程。create_task 则把协程安排成任务。等待过程中，事件循环可以运行其他任务，但不是每个 await 都必然挂起。</p><p>cancel() 是取消请求。取消通常在可挂起点以 CancelledError 交给协程；捕获后应在必要清理结束时重新抛出。否则可能破坏 TaskGroup 或超时机制。本课不讲主动抑制取消与 uncancel 的高级用法。</p><p>本例使用 Event 确保任务已进入等待再取消，不靠固定毫秒延迟猜顺序。离开本节后，两份观察位置复原。</p></details>
    <Script code={item.code}/>
  </>;
}

const groupLabels=['同伴进入等待','一项任务报告失败','观察同伴清理','外层收到异常组'];
function TaskGroupExit() {
  const [selected,setSelected]=useState('clean');
  const [step,setStep]=useState(0);
  const item=data.taskgroups.find(c=>c.id===selected)!;
  const finished=step===item.events.length;
  return <>
    <div className="concurrent-picker" role="group" aria-label="选择同伴清理结果">{data.taskgroups.map(c=><button key={c.id} aria-pressed={selected===c.id} onClick={()=>{setSelected(c.id);setStep(0);}}>{c.label}</button>)}</div>
    <div className="taskgroup-milestones" role="group" aria-label="TaskGroup的因果节点">{item.events.map((event,i)=><button key={i} aria-pressed={step===i+1} onClick={()=>setStep(i+1)}><span>0{i+1}</span><strong>{groupLabels[i]||event}</strong><small>{step>i?'已观察':'选择这一节点'}</small></button>)}</div>
    <div className="taskgroup-gate"><div><span className="sample-label">当前已展示的真实事件</span><pre>{item.events.slice(0,step).join('\n')||'尚未开始'}</pre><p role="status">{step===0?'先让同伴进入等待，再触发另一项任务失败。':step===1?'Event 保证等待任务已就绪，失败任务随后才继续。':step===2?'非取消失败触发 TaskGroup 请求取消同伴；组退出还要等同伴收尾。':step===3?'已经观察到清理事件；若清理再次抛错，这个失败也需要交给外层。':'所有子任务已结束，外层现在收到聚合后的失败。'}</p></div><div className={'taskgroup-result '+(finished?'taskgroup-received':'')} aria-live="polite"><span className="sample-label">组外的调用者</span>{finished?<><TreeView tree={item.tree} label="实际收到的异常组"/><p>同伴 done = {item.peerDone?'True':'False'}<br/>同伴 cancelled = {item.peerCancelled?'True':'False'}</p><p>{selected==='clean'?'同伴以取消结束，取消本身没有成为组里的普通失败。':'同伴结束于清理失败，因此不是 cancelled 状态；组中保留 ValueError 和 RuntimeError。'}</p></>:<div className="taskgroup-wait"><strong>尚未展示外层结果</strong><p>先观察同伴清理，再查看异常组。</p></div>}</div></div>
    <div className="concurrent-actions"><button disabled={step===0} onClick={()=>setStep(step-1)}>上一个组退出节点</button><button className="primary" disabled={finished} onClick={()=>setStep(step+1)}>下一个组退出节点</button><button onClick={()=>setStep(0)}>重置组退出过程</button></div>
    <details className="sample-note"><summary>TaskGroup 的保证与边界</summary><p>Python 3.11 的 TaskGroup 在子任务发生非取消失败时，会请求取消同伴，并等待它们结束，然后聚合失败。它不会自动重试；同伴若吞掉取消后持续运行，组退出仍可能一直等待。</p><p>async with 主体的异常也可能进入最终组。KeyboardInterrupt 和 SystemExit 会在等待子任务收尾后单独重新抛出，不按普通失败组交付。</p><p>这里只保证这个 Event 同步案例的因果顺序。异常组成员按类型集合判断，不从显示顺序推断任意并发调度。3.13 改进了同时内外取消等边界，本课固定使用 3.11 数据，不混用新版本规则。</p></details>
    <Script code={item.code}/>
  </>;
}

function GeneratorExit() {
  const [selected,setSelected]=useState('return');
  const [ran,setRan]=useState(false);
  const item=data.generators.find(c=>c.id===selected)!;
  return <>
    <p className="concurrent-prompt">三个例子都先用 next() 取得 <code>"open"</code>，再观察下一次推进或关闭。</p>
    <div className="concurrent-picker" role="group" aria-label="选择生成器结束方式">{data.generators.map(c=><button key={c.id} aria-pressed={selected===c.id} onClick={()=>{setSelected(c.id);setRan(false);}}>{c.label}</button>)}</div>
    <button className="primary" onClick={()=>setRan(true)}>观察生成器怎样结束</button>
    <div className="generator-boundary" aria-live="polite"><div><span className="sample-label">生成器内部的结束方式</span><strong>{selected==='return'?'return 9':selected==='stop'?'raise StopIteration("inside")':'close() 注入 GeneratorExit'}</strong></div><span className="generator-arrow" aria-hidden="true">→</span><div><span className="sample-label">调用者观察到</span><strong>{ran?(item.error||'close() 正常返回'):'等待观察'}</strong>{ran&&<dl><dt>value</dt><dd>{item.value===null?'None':String(item.value)}</dd><dt>cause</dt><dd>{item.cause||'None'}</dd><dt>清理</dt><dd>{item.cleaned?'已执行':'未执行'}</dd></dl>}</div></div>
    {ran&&<p className="concurrent-explanation" role="status">{selected==='return'?'正常耗尽用 StopIteration 通知调用者，return 的 9 放在它的 value 属性中。for 循环会处理耗尽信号；这里直接 next()，所以外层能捕获它。':selected==='stop'?'从生成器体意外逃出的 StopIteration 被转为 RuntimeError，原异常保留为 cause，防止内部错误被误当作正常耗尽。':'close() 让暂停的生成器处理关闭信号，并运行 finally。不要捕获 GeneratorExit 后继续 yield；本例清理后让关闭完成。'}</p>}
    <details className="sample-note"><summary>版本与生命周期</summary><p>这里使用 Python 3.11：close() 本例返回 None，不展示 3.13 起新增的关闭返回值行为。只在确实开始执行并停在 yield 后调用 close，才能观察本例的 finally。</p><p>生成器关闭与协程取消都是生命周期信号，清理后应让关闭或取消完成。异步生成器也有自己的关闭协议；不把本例扩大为全部异步资源管理规则。</p></details>
    <Output events={item.events}/><Script code={item.code}/>
  </>;
}

export default function ChapterEleven(props:GuidedProps) {
  return <GuidedChapter {...props} subtitle="分开看多个失败，也让取消和关闭有清楚的终点。" lessons={[
    {label:'异常组',title:'一组失败，按类型拆开后还剩什么？',intro:'按类型分开匹配部分，保留原有嵌套路径。',content:<SplitTree/>},
    {label:'except*',title:'处理过一部分，剩下的会消失吗？',intro:'比较普通 except 和多个 except* 分支，再观察外层收到什么。',content:<StarBranches/>},
    {label:'取消信号',title:'清理做完了，就算正确处理取消了吗？',intro:'把正常传播与吞掉取消的有限反例分开观察。',content:<Cancellation/>},
    {label:'TaskGroup',title:'一项任务失败，组在什么时候退出？',intro:'先看同伴收尾，再看交给组外的异常。',content:<TaskGroupExit/>},
    {label:'生成器关闭',title:'正常耗尽、内部错误和关闭是一回事吗？',intro:'从同一个 yield 起点，比较三个结束方式。',content:<GeneratorExit/>},
  ]} recap={<div className="sample-recap-grid">{[
    ['拆分仍保留结构','except* 按成员匹配，可运行多个分支；未处理部分继续传播，嵌套路径不会自动展平。'],
    ['清理后保留停止信号','CancelledError 通常应在清理后继续传播。TaskGroup 会等待同伴结束，清理新失败也可能被聚合。'],
    ['区分三种终点','生成器 return 表达耗尽，意外 StopIteration 是内部错误；close 用 GeneratorExit 请求关闭。'],
  ].map(([title,text],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>}/>;
}
