import { useState } from 'react';
import GuidedChapter, { TraceEvidence, type GuidedProps } from './GuidedChapter';
import Code from './Code';
import data from './data/resources.json';
import './resources.css';

type ResourceEvent = {kind:string; text:string; registered:string[]};
function Script({item}:{item:{code:string}}) {
  return <details className="sample-note"><summary>查看这次运行的完整 Python 脚本</summary><Code code={item.code}/><p>events、exits 和 registered 仅用于记录轨迹；Resource 是教学管理器，不打开真实文件。脚本外层捕获异常，便于观察传播结果。</p></details>;
}
function Output({output}:{output:string[]}) {
  return <div className="sample-console resource-output"><span className="sample-label">输出 · 含外层观察</span><pre>{output.join('\n')}</pre></div>;
}
function withBody(code:string) {
  return code.split('\ntry:\n')[1].split('\nexcept Exception as error:')[0]
    .split('\n').map(line=>line.slice(4)).join('\n').trimEnd();
}
function EnterGate() {
  const [choice,setChoice]=useState(1);
  const [revealed,setRevealed]=useState(false);
  const item=data.enter[choice];
  const has=(kind:string)=>item.events.some(e=>e.kind===kind);
  return <>
    <div className="resource-picker" role="group" aria-label="选择进入结果">{data.enter.map((c,i)=><button key={c.id} aria-pressed={choice===i} onClick={()=>{setChoice(i);setRevealed(false);}}>{c.label}</button>)}</div>
    <Code code={withBody(item.code)} label="Python 摘录 · emit 打印并记录事件，定义见完整脚本"/>
    <p className="resource-question">如果 <code>__enter__</code> 自己抛错，下面两步还会发生吗？</p>
    <div className="resource-gate" aria-label="进入、使用、退出的调用关系">{[
      ['01 · 进入','__enter__',has('ready')?'成功返回 resource:A':'抛出 OSError',true],
      ['02 · 使用','with 体',has('body')?'已运行；as value 收到返回值':'未进入',has('body')],
      ['03 · 收尾','__exit__',has('exit')?'已调用，收到三个 None':'未调用',has('exit')],
    ].map(([label,title,text,ran])=><div key={String(title)} className={'resource-gate-card '+(revealed&&!ran?'resource-skipped':'')}><span className="sample-label">{label}</span><strong>{title}</strong><p>{revealed?text:'等待观察'}</p></div>)}</div>
    <div className="resource-actions"><button className="primary" onClick={()=>setRevealed(true)}>查看本次路径</button><button onClick={()=>{setChoice(1);setRevealed(false);}}>重置观察</button></div>
    <div className="resource-answer" role="status">{revealed ? has('ready')?'进入成功后，with 负责在离开时调用退出方法。as 绑定的是 __enter__ 的返回值，可以与管理器本身不同。':'失败停在进入阶段：with 体没开始，也不会调用这个对象的 __exit__。若已取得部分资源，__enter__ 要自行清理后再抛出。':'先预测，再查看实际调用路径。'}</div>
    {revealed&&<Output output={item.output}/>}
    <details className="sample-note"><summary>用到文件：关闭和成功是两回事</summary><Code code={'import json\n\nwith open("tasks.json", encoding="utf-8") as stream:\n    tasks = json.load(stream)'} label="Python 片段 · 需提供 tasks.json 文件"/><p>open 失败时，文件上下文尚未进入。若打开后 JSON 解析失败，文件仍会关闭，解析异常继续传播；关闭文件不能证明数据已读成功。</p><p>with 调用的是对象定义的协议。退出方法也可能抑制异常或再次抛错，不能把所有管理器都当作同一段 try/finally。</p></details>
    <Script item={item}/>
  </>;
}

function ExitDecision() {
  const [choice,setChoice]=useState(1);
  const [selective,setSelective]=useState(true);
  const [ran,setRan]=useState(false);
  const item=data.exit[choice][selective?'selective':'propagate'];
  const args=item.exits[0];
  const normal=args.type===null;
  const continued=item.events.some(e=>e.kind==='continued');
  return <>
    <div className="resource-picker" role="group" aria-label="选择代码块结果">{data.exit.map((c,i)=><button key={c.id} aria-pressed={choice===i} onClick={()=>{setChoice(i);setRan(false);}}>{c.label}</button>)}</div>
    <div className="resource-exit-layout">
      <div><fieldset className="resource-policy"><legend>退出策略</legend><label><input type="radio" name="exit-policy" checked={selective} onChange={()=>{setSelective(true);setRan(false);}}/>只抑制 ValueError</label><label><input type="radio" name="exit-policy" checked={!selective} onChange={()=>{setSelective(false);setRan(false);}}/>清理后继续传播</label></fieldset><Code code={withBody(item.code)} label="Python 摘录 · emit 打印并记录事件"/><Code code={'def __exit__(self, kind, value, tb):\n    # 此处省略轨迹记录与清理细节\n    return '+(selective?'self.suppress and kind is ValueError':'False')} label={'Python 协议摘录 · 当前 suppress 为 '+(selective?'True':'False')}/><button className="primary" onClick={()=>setRan(true)}>观察退出结果</button></div>
      <div className="resource-envelope" aria-live="polite"><span className="sample-label">传给 __exit__ 的三个参数</span><dl>{[
        ['kind',args.type||'None'],['value',args.valueType?`${args.valueType}("${args.message}")`:'None'],['tb',args.traceback?'traceback 对象':'None'],
      ].map(([key,value])=><div key={key}><dt>{key}</dt><dd>{ran?value:'待观察'}</dd></div>)}</dl><p>{ran?(normal?'正常离开：没有异常可抑制。':'value 是这次异常实例，tb 记录它的回溯。'):'参数随退出原因改变。'}</p><div className="resource-verdict">{ran?`返回 ${args.result?'True':'False'} → ${normal?'with 后继续':continued?'抑制异常，with 后继续':'异常传播到外层'}`:'先选退出策略，再观察'}</div></div>
    </div>
    {ran&&<><p className="resource-answer" role="status">{normal?'这次完整执行了 body tail，再退出。正常返回、break 等无异常离开，也会以三个 None 调用 __exit__；它的返回值不能取消这些控制流。':continued?'异常发生后，body tail 被跳过。抑制让执行从 with 后继续，不会回到出错那一行重试。':'退出方法已运行，但这类异常没有被抑制。外层 except 收到它，with 后的 after with 没有执行。'}</p><Output output={item.output}/></>}
    <details className="sample-note"><summary>抑制之前，要确认什么？</summary><p>返回真值是一项恢复决定：只对明确允许忽略的失败这样做。本例用精确类型判断，只抑制 ValueError 本身；若要包含子类，应另外定义并验证策略。</p><p><code>contextlib.suppress(FileNotFoundError)</code> 可用于“目标本来就可以不存在”的小范围操作；它匹配该类型及子类，不会抑制 PermissionError。不要用 suppress(Exception) 隐藏未知失败。</p><p>若 __exit__ 自己抛出新异常，新异常会传播；一个原本打算返回的真值不会保护清理代码。</p></details>
    <details className="sample-note"><summary>本地练习里的 @contextmanager 怎样工作？</summary><Code code={'from contextlib import contextmanager\n\n@contextmanager\ndef managed(events):\n    events.append("open")\n    try:\n        yield "resource"\n    finally:\n        events.append("close")'} label="Python · 可独立定义的上下文管理器"/><p>yield 前是进入阶段，产出的值交给 as。块内异常会在 yield 处重新抛入生成器，finally 因而可以清理。若捕获它仅为了记录，之后要重新 raise；捕获后正常结束会抑制该异常。</p><p>被装饰的生成器必须恰好 yield 一次。本例的 ValueError 条件抑制留给原编程练习实现。</p></details>
    <Script item={item}/>
  </>;
}

function resourceState(item:ResourceEvent[],name:string) {
  if(item.some(e=>e.kind==='exit'&&e.text.startsWith(`exit ${name}:`))) return '已退出';
  if(item.some(e=>e.text===`enter failed ${name}`)) return '进入失败 · 未登记';
  if(item.some(e=>e.text===`register ${name}`)) return '已登记退出动作';
  if(item.some(e=>e.text===`ready ${name}`)) return '进入成功 · 随即登记';
  if(item.some(e=>e.text===`enter ${name}`)) return '正在进入';
  return '尚未进入';
}
function CleanupStack({callbackScenario}:{callbackScenario:GuidedProps['scenarios'][number]}) {
  const [choice,setChoice]=useState(1);
  const [step,setStep]=useState(0);
  const item=data.stack[choice];
  const seen=item.events.slice(0,step);
  const current=seen.at(-1);
  const pending=current?.registered||[];
  const explanation=!current?'先进入 A。退出动作要等进入成功后才能登记。':current.kind==='failed'?'B 的 __enter__ 抛出 OSError，B 没有登记；接下来只退出已经登记的 A。':current.kind==='register'?'刚进入成功的资源，其退出动作现在已登记。':current.kind==='exit'?'取出最后登记的退出动作，完成这一项收尾。':current.kind==='caught'?'外层收到异常。清理已经结束，异常没有被当作成功结果。':current.kind==='continued'?'正常退出后，继续 with 后面的代码。':'观察右侧：已登记的退出动作才会参与随后清理。';
  return <>
    <div className="resource-picker" role="group" aria-label="选择多个资源的路径">{data.stack.map((c,i)=><button key={c.id} aria-pressed={choice===i} onClick={()=>{setChoice(i);setStep(0);}}>{c.label}</button>)}</div>
    <Code code={withBody(item.code).split('\n').filter(line=>!line.includes('registered.')&&!line.includes('emit(')).join('\n')} label="Python 摘录 · 省略轨迹记录"/>
    <div className="resource-stack-layout"><div><span className="sample-label">资源状态</span><div className="resource-inventory">{['A','B'].map(name=><div key={name}><strong>{name}</strong><span>{resourceState(seen,name)}</span></div>)}</div><div className="resource-event" role="status"><span className="sample-label">事件 {step} / {item.events.length}</span><code>{current?.text||'尚未开始'}</code><p>{explanation}</p></div></div><div className="resource-stack"><span className="sample-label">待执行的退出动作 · 从上往下</span><ol>{pending.slice().reverse().map(name=><li key={name}><code>{name}.__exit__</code><span>待清理</span></li>)}</ol>{pending.length===0&&<p className="resource-empty">{step===item.events.length?'已无待清理项':'还没有登记项'}</p>}<p>后登记的先退出</p></div></div>
    <div className="resource-actions"><button disabled={step===0} onClick={()=>setStep(step-1)}>上一个事件</button><button className="primary" disabled={step===item.events.length} onClick={()=>setStep(step+1)}>下一个事件</button><button onClick={()=>setStep(0)}>重置清理过程</button></div>
    <details className="sample-note"><summary>一次查看完整输出</summary><Output output={item.output}/></details>
    <Script item={item}/>
    <details className="sample-note"><summary>ExitStack 和多个 with，有什么区别？</summary><p><code>with A() as a, B() as b:</code> 的进入和退出顺序类似嵌套 with；B 进入失败时，已经进入的 A 仍会退出。ExitStack 适合资源数量由运行时决定的情况，可以逐个 enter_context。</p><p>enter_context 成功进入后才登记 __exit__。callback 则登记普通清理函数，它不接收异常三参数，也不能靠返回值抑制异常。清理顺序均为后进先出。</p><p>若内层退出方法抑制或替换异常，外层退出方法收到的是更新后的异常状态。本节管理器的退出方法不会抛错或抑制，先聚焦顺序。</p><TraceEvidence scenario={callbackScenario} label="原有 callback 案例 · 最终输出"/></details>
  </>;
}

export default function ChapterEight(props:GuidedProps) {
  return <GuidedChapter {...props} subtitle="先看资源有没有成功进入，再决定谁来清理、异常往哪走。" lessons={[
    {label:'进入边界',title:'进入失败，谁负责收尾？',intro:'with 的清理承诺，从 __enter__ 成功返回开始。',content:<EnterGate/>},
    {label:'退出与抑制',title:'清理过了，异常还会继续吗？',intro:'看清退出方法收到的三个参数，再比较两种处理策略。',content:<ExitDecision/>},
    {label:'逆序清理',title:'第二个资源失败，第一个怎么办？',intro:'逐个登记退出动作，看 ExitStack 怎样收回已经取得的资源。',content:<CleanupStack callbackScenario={props.scenarios.find(s=>s.id==='08-exitstack')!}/>},
  ]} recap={<div className="sample-recap-grid">{[
    ['进入有边界','__enter__ 成功后才执行块体并安排退出；进入失败时，部分资源由进入方法自行收尾。'],
    ['清理与恢复分开','__exit__ 正常退出收到三个 None，异常退出收到类型、实例和回溯。真值抑制传入的异常，不会重跑块体。'],
    ['登记决定顺序','ExitStack 后登记先清理；enter_context 进入失败的那一项不会登记，之前成功的仍会退出。'],
  ].map(([title,text],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>}/>;
}
