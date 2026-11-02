import { useState } from 'react';
import Code from './Code';
import GuidedChapter, { type GuidedProps } from './GuidedChapter';
import data from './data/reliability.json';
import './reliability.css';

function Script({code}:{code:string}) {
  return <details className="sample-note"><summary>查看当前案例的完整 Python 脚本</summary><Code code={code}/><p>在配套项目根目录运行。等待函数只记录时间，不实际等待。</p></details>;
}
function RetryBudget() {
  const [caseId,setCaseId]=useState('third-success');
  const [limit,setLimit]=useState(2);
  const [ran,setRan]=useState(false);
  const item=data.retries.find(c=>c.id===caseId)!;
  const plan=item.plans.find(p=>p.limit===limit)!;
  return <>
    <div className="reliability-picker" role="group" aria-label="选择失败类型与持续时间">{data.retries.map(c=><button key={c.id} aria-pressed={caseId===c.id} onClick={()=>{setCaseId(c.id);setRan(false);}}>{c.label}</button>)}</div>
    <div className="retry-budget"><span>总尝试上限 <small>包括第一次执行</small></span><div role="group" aria-label="选择总尝试次数">{[2,3].map(n=><button key={n} aria-pressed={limit===n} onClick={()=>{setLimit(n);setRan(false);}}>最多 {n} 次</button>)}</div></div>
    <p className="reliability-prompt">本例只对声明的 <code>TransientError</code> 重试。上限为 {limit} 次，最多再试 {limit-1} 次。</p>
    <div className="reliability-actions"><button className="primary" onClick={()=>setRan(true)}>查看执行结果</button><button onClick={()=>{setCaseId('third-success');setLimit(2);setRan(false);}}>重置策略</button></div>
    {ran?<div className="retry-observation" aria-live="polite"><div className="retry-attempts" aria-label="实际尝试与等待">{plan.attempts.map(a=><div className="retry-attempt" key={a.number}><span className="sample-label">尝试 {a.number}</span><strong>{plan.kind==='returned'&&a.number===plan.attempts.length?'返回 '+plan.value:a.outcome}</strong><span className="retry-wait">{a.delayAfter===null?'本次之后不再等待':`记录等待 ${a.delayAfter} 秒 → 再试`}</span></div>)}</div><div className={'retry-terminal '+(plan.kind==='raised'?'retry-ended-error':'')}><span className="sample-label">调用者最终得到</span><h3>{plan.kind==='returned'?`结果 ${plan.value}`:plan.error}</h3><p>{plan.kind==='returned'?'操作正常返回，循环立即结束。':plan.error==='TransientError'?'次数用完，裸 raise 继续抛出最后一次失败；不会静默返回成功。':'这种异常不在重试策略中，第一次失败就向外传播。'}</p><small>实际调用 {plan.attempts.length} 次 · 等待 {plan.delays.length} 次{plan.kind==='raised'&&plan.sameLastException?' · 保留最后异常对象':''}</small></div></div>:<div className="retry-empty">先预测：这组上限足以等到成功吗？</div>}
    <p className="sample-caption">等待值来自实际调用 sleep 参数的记录；页面和脚本都不实际等待。失败的最后一次不会再安排等待。</p>
    <details className="sample-note"><summary>对照有限重试函数</summary><Code code={data.retryCode}/><p>attempts 只接受正整数。注入 sleep 后，测试能检查退避参数而不用耗时等待；普通调用默认使用真实 sleep。</p></details>
    <details className="sample-note"><summary>错误类型相同，就一定值得重试吗？</summary><p>TransientError 是这个应用明确约定的暂时失败，不是 Python 自动认定“过一会儿会好”。先确认失败可能消失，并且重复操作安全，再制定策略。</p><p>次数上限不等于总耗时上限：单次调用也可能一直等待。真实 I/O 应有适合客户端的超时和整体时间预算，不能只在循环外数次数。</p><p>实际系统还可给退避设上限并加入随机抖动，避免大量客户端同步重试；本节使用固定等待值便于观察，不模拟随机调度。</p></details>
    <Script code={plan.code}/>
  </>;
}

function LostAcknowledgement() {
  const [mode,setMode]=useState('stable-key');
  const [ran,setRan]=useState(false);
  const item=data.delivery.find(c=>c.id===mode)!;
  const repeated=item.effects.length>1;
  return <>
    <p className="reliability-prompt">接收端已经追加了一条记录，但第一次确认丢失。调用者只看到失败，于是再调用一次。</p>
    <div className="delivery-path" aria-label="一次结果不明确的调用"><div><span>01</span><strong>记录已追加</strong><small>接收端发生了效果</small></div><span aria-hidden="true">→</span><div><span>02</span><strong>确认未收到</strong><small>调用者观察到失败</small></div><span aria-hidden="true">→</span><div><span>03</span><strong>再次调用</strong><small>会不会再追加一条？</small></div></div>
    <div className="reliability-picker" role="group" aria-label="选择接收端去重策略">{data.delivery.map(c=><button key={c.id} aria-pressed={mode===c.id} onClick={()=>{setMode(c.id);setRan(false);}}>{c.label}</button>)}</div>
    <button className="primary" onClick={()=>setRan(true)}>查看接收端留下什么</button>
    <div className="delivery-ledger" aria-live="polite"><div className="delivery-ledger-title"><span className="sample-label">接收端记录 · 内存教学模型</span><strong>{ran?`${item.effects.length} 条记录`:'等待观察'}</strong></div>{ran?<><ol>{item.effects.map((effect,i)=><li key={i}><span>{String(i+1).padStart(2,'0')}</span><code>{effect.key}</code><b>value = {effect.value}</b></li>)}</ol><div className="delivery-result"><span>实际调用 {item.calls} 次</span><strong>{repeated?'留下了重复效果':'同一请求只追加一次'}</strong></div></>:<p className="delivery-empty">同一次业务请求，调用次数和实际效果次数可能不同。</p>}</div>
    {ran&&<p className="reliability-explanation" role="status">{mode==='stable-key'?'两次使用同一个键，接收端认出已完成的相同请求，沿用已有状态并直接确认。记录和去重信息在第一次确认丢失之前就已保存。':mode==='new-key'?'每次都换一个键，接收端会把它们当作两个请求。仅仅有“去重键”这个字段，不能保证安全重试。':'追加动作再次发生。一次超时或确认丢失，不能证明接收端之前什么都没做。'}</p>}
    <details className="sample-note"><summary>推荐比较顺序</summary><ol><li>先看固定键去重：两次调用只有一条记录。</li><li>改为不去重：同样两次调用，留下两条。</li><li>再看每次换键：虽然接收端支持去重，键不同仍会重复。</li></ol></details>
    <details className="sample-note"><summary>这个去重模型保证到哪里？</summary><p>幂等强调重复请求不会叠加预期效果，不要求每次响应都相同。本例用稳定请求键识别已经完成的相同输入；同键却换负载必须拒绝。</p><p>这里只用单进程内存，保存效果与去重信息之间没有并发或崩溃。真实系统还要保证二者的一致性，设计持久化、并发控制、键的有效期和失败后的核对方式，不能只在客户端加一个字典。</p><p>本例故意在追加之后报告确认失败，说明不确定结果；并没有实际发送网络请求，也没有把所有 TimeoutError 都归为可重试错误。</p></details>
    {ran&&<details className="sample-note"><summary>查看实际事件记录</summary><pre className="reliability-events">{item.events.join('\n')}</pre></details>}
    <Script code={item.code}/>
  </>;
}

function PartialProgress() {
  const [mode,setMode]=useState('resume');
  const [phase,setPhase]=useState('failure');
  const item=data.partial.find(c=>c.id===mode)!;
  const snapshot=item.snapshots.find(s=>s.id===phase)!;
  const final=phase==='final';
  return <>
    <div className="reliability-picker" role="group" aria-label="选择部分失败后的处理">{data.partial.map(c=><button key={c.id} aria-pressed={mode===c.id} onClick={()=>{setMode(c.id);setPhase('failure');}}>{c.label}</button>)}</div>
    <div className="partial-phase" role="group" aria-label="选择观察时点"><button aria-pressed={!final} onClick={()=>setPhase('failure')}>首次失败后</button><button aria-pressed={final} onClick={()=>setPhase('final')}>尝试结束后</button></div>
    <div className="partial-board" aria-label="保存与通知的实际状态"><div className="partial-step"><span className="sample-label">步骤一 · 保存</span><strong>已保存</strong><div className="partial-records">{Array.from({length:snapshot.writes},(_,i)=><span key={i}>记录 {i+1}</span>)}</div><p>实际写入 {snapshot.writes} 次</p></div><div className={'partial-step '+(!snapshot.notified?'partial-incomplete':'')}><span className="sample-label">步骤二 · 通知</span><strong>{snapshot.notified?'已完成通知':'通知尚未完成'}</strong><div className="partial-notice">{snapshot.notified?'确认完成':'失败留在这一步'}</div><p>实际尝试通知 {snapshot.notifyAttempts} 次</p></div></div>
    <div className="partial-overall" role="status"><span className="sample-label">{final?'有限尝试后的结果':'第一次失败时的快照'}</span><h3>{!final?'任务报错，保存效果仍然存在':item.kind==='returned'?'两步都完成了':'任务仍失败，已保存的效果没有消失'}</h3><p>{!final?'try/except 改变接下来的执行路径，不会自动撤销已经做完的步骤。':mode==='restart'?'从头重跑再次保存，留下了两次写入。重试范围覆盖了已经成功的步骤。':mode==='resume'?'保存完成后留下检查点，第二次只重试通知。本例在同一进程内避免了重复保存。':'通知重试后仍失败，最后的异常继续传播。检查点能避免重复保存，但不能把未完成的通知变成成功。'}</p></div>
    <button className="reliability-reset" onClick={()=>{setMode('resume');setPhase('failure');}}>重置观察时点</button>
    <p className="sample-caption">两个时点都是 Python 实际状态的快照；这里只记录内存中的保存与通知，不写文件或发通知。</p>
    <details className="sample-note"><summary>检查点与事务，有什么区别？</summary><p>本例的检查点只是当前进程中的标记；进程退出就丢失。保存、更新检查点和通知之间也没有跨系统原子性保证。</p><p>如果要求两步要么一起生效、要么都不生效，需要适用的事务或协调方案。若允许分步完成，则要设计幂等步骤、可靠检查点及明确的补偿或人工处理路径；不能把一次异常捕获当作自动回滚。</p><p>贯穿项目的 Processor 在 worker 成功返回后才缓存结果，缓存属于当前实例。它适合本课的纯计算 worker；worker 失败前若已改变外部状态，这个成功缓存仍无法撤销或去重那些效果。</p></details>
    <details className="sample-note"><summary>查看实际事件记录</summary><pre className="reliability-events">{item.events.join('\n')}</pre></details>
    <Script code={item.code}/>
  </>;
}

export default function ChapterTen(props:GuidedProps) {
  return <GuidedChapter {...props} subtitle="重试前先问：失败可能消失吗，重复执行会留下什么？" lessons={[
    {label:'有限重试',title:'再试一次，什么时候该停？',intro:'改变次数上限，比较成功、耗尽和不该重试的失败。',content:<RetryBudget/>},
    {label:'重复效果',title:'没有收到确认，就能放心重试吗？',intro:'接收端可能已经做完；比较稳定键与重复追加。',content:<LostAcknowledgement/>},
    {label:'部分成功',title:'任务报错了，哪些步骤已经发生？',intro:'从两个观察时点，分清恢复、重复执行和仍未完成的工作。',content:<PartialProgress/>},
  ]} recap={<div className="sample-recap-grid">{[
    ['重试有条件和终点','只对约定的暂时失败有限重试。耗尽后报告最后失败；次数、单次超时和总耗时都需要边界。'],
    ['确认与效果分开','未收到确认不能证明没有执行。安全重复需要稳定请求身份及接收端的幂等处理。'],
    ['承认部分成功','异常不会撤销已发生的效果。恢复方案要说明重试哪一步、保留哪些状态、最终失败交给谁。'],
  ].map(([title,text],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>}/>;
}
