import { useState } from 'react';
import Code from './Code';
import GuidedChapter, { type GuidedProps } from './GuidedChapter';
import data from './data/project.json';
import './project.css';

type Result = {id:string;status:string;value:number|null;error:string|null;attempts:number};
function Script({code}:{code:string}) {
  return <details className="sample-note"><summary>查看本例的完整脚本</summary><Code code={code}/><p>在配套项目根目录运行。脚本调用 Processor；sleep 只记录等待时间。</p></details>;
}
function Results({items}:{items:Result[]}) {
  return <div className="project-results"><span className="sample-label">实际返回的 Result 列表</span><div className="project-table-scroll"><table><thead><tr><th>id</th><th>status</th><th>value</th><th>attempts</th></tr></thead><tbody>{items.map((r,i)=><tr key={i}><td>{r.id}</td><td><span className={'project-status status-'+r.status}>{r.status}</span></td><td>{r.value===null?'None':r.value}</td><td>{r.attempts}</td></tr>)}</tbody></table></div>{items.some(r=>r.error)&&<details><summary>失败条目的诊断消息</summary>{items.filter(r=>r.error).map((r,i)=><p key={i}><code>{r.id}</code>：{r.error}</p>)}</details>}</div>;
}
function Calls({calls}:{calls:string[]}) {
  return <div className="project-calls"><span className="sample-label">真实 worker 调用顺序</span>{calls.length?<ol>{calls.map((id,i)=><li key={i}><small>{i+1}</small><code>{id}</code></li>)}</ol>:<p>没有调用 worker</p>}</div>;
}
function Cache({committed,label='这个 Processor 实例的成功缓存'}:{committed:Partial<Record<string,number>>;label?:string}) {
  return <div className="project-committed"><span className="sample-label">{label}</span>{Object.keys(committed).length?<dl>{Object.entries(committed).map(([id,value])=><div key={id}><dt>{id}</dt><dd>{value}</dd></div>)}</dl>:<p>缓存为空</p>}</div>;
}

function EntryGate() {
  const [selected,setSelected]=useState('invalid-row');
  const [ran,setRan]=useState(false);
  const item=data.entry.find(c=>c.id===selected)!;
  return <>
    <div className="project-picker" role="group" aria-label="选择整批输入">{data.entry.map(c=><button key={c.id} aria-pressed={selected===c.id} onClick={()=>{setSelected(c.id);setRan(false);}}>{c.label}</button>)}</div>
    <div className="project-input"><span className="sample-label">交给 parse_tasks 的 JSON 文本</span><pre>{item.text}</pre></div>
    <button className="primary" onClick={()=>setRan(true)}>查看项目的实际结果</button>
    <div className="project-entry" aria-label="输入边界与任务执行"><div><span>01 · 解析 JSON</span><strong>{!ran?'待观察':selected==='bad-json'?'拒绝解析':'得到 JSON 数据'}</strong></div><div><span>02 · 校验整批任务</span><strong>{!ran?'待观察':selected==='bad-json'?'尚未进入':item.accepted?'整批校验通过':'任务格式被拒绝'}</strong></div><div><span>03 · 执行 worker</span><strong>{!ran?'待观察':item.calls.length?`调用 ${item.calls.length} 次`:'一次也没调用'}</strong></div></div>
    {ran&&<><p className="project-explanation" role="status">{item.accepted?'整批解析和校验都成功，才把 Task 列表交给调度器。':selected==='bad-json'?'文本还没有解析成任务数据。InputError 保留底层 JSONDecodeError 为 cause。':'第一条合法也不会先执行。第二条把 bool 当成整数，被 Task 校验拒绝；整批输入尚未交给 worker。'}</p><div className="project-entry-observation"><Calls calls={item.calls}/><div><span className="sample-label">外层观察</span><dl><dt>error</dt><dd>{item.error||'None'}</dd><dt>cause</dt><dd>{item.cause||'None'}</dd></dl>{item.notes.length>0&&<p>备注：{item.notes.join('；')}</p>}</div></div></>}
    <details className="sample-note"><summary>先检查输入，还是直接做操作？</summary><p>这里先校验字段与类型，是为了在启动前拒绝整批坏数据。对文件是否能读，真正的依据仍是读取操作：load_tasks 在 with open 中读取，捕获 OSError 或 UnicodeError 后转换成 InputError。</p><p>预先检查常被称为 LBYL，先尝试再捕获失败常被称为 EAFP。两者按边界选择；“先检查文件存在”不能保证紧接着读取一定成功，检查与操作之间状态仍可能变化。</p><p>本节从文本开始。第四节可直接运行真正的文件输入 CLI；它先 load_tasks，再 process_batch。</p></details>
    <Script code={item.code}/>
  </>;
}

function BatchBoundary() {
  const [selected,setSelected]=useState('expected');
  const [ran,setRan]=useState(false);
  const item=data.batches.find(c=>c.id===selected)!;
  return <>
    <p className="project-prompt">这三条任务已通过输入校验。向真实 Processor 注入一个教学 worker，让第二条在执行时失败。</p>
    <div className="project-picker" role="group" aria-label="选择执行期失败">{data.batches.map(c=><button key={c.id} aria-pressed={selected===c.id} onClick={()=>{setSelected(c.id);setRan(false);}}>{c.label}</button>)}</div>
    <button className="primary" onClick={()=>setRan(true)}>查看批次如何继续</button>
    <div className="project-task-row">{item.tasks.map((task,i)=>{
      const result=item.results?.[i];
      const called=item.calls.includes(task.id);
      return <div className={'project-task '+(ran&&result?'task-'+result.status:'')} key={task.id}><span className="sample-label">任务 {i+1}</span><strong>{task.id}</strong><code>value = {task.value}</code><p>{!ran?'待观察':result?result.status:!called?'未执行':Object.hasOwn(item.committed,task.id)?'已执行，结果留在缓存中':'执行中抛出 TypeError'}</p></div>;
    })}</div>
    {ran&&<><div className="project-batch-output" aria-live="polite"><p className="project-explanation">{selected==='expected'?'PermanentError 属于约定的 TaskError，调度器记录 failed 并继续第三条，不重试它。':selected==='exhausted'?'TransientError 最多尝试两次，耗尽后交给批次边界记录 failed，第三条仍继续。':'TypeError 不属于预期 TaskError，直接向外传播；第三条没有执行，也没有返回一份完整 Result 列表。'}</p>{item.results?<Results items={item.results}/>:<div className="project-interrupted"><strong>没有返回 Result 列表</strong><p>外层教学观察器捕获 {item.error}。这不代表处理器已将缺陷恢复成普通失败。</p></div>}<div className="project-observers"><Calls calls={item.calls}/><Cache committed={item.committed}/></div><p className="sample-caption">实际记录的等待参数：{item.delays.length?item.delays.join('、')+' 秒':'无等待'}。中断不会自动撤销此前的成功缓存。</p></div></>}
    <details className="sample-note"><summary>attempts 为 0，真的表示没尝试吗？</summary><p>本项目 done 记录本次调用直到成功为止的总尝试次数（含成功那次）；cached 与 failed 使用 Result 的默认 attempts=0，没有记录历史尝试明细。看真实调用顺序才能判断失败任务执行了几次。</p><p>status/id 是供程序读取的字段，error 是供人诊断的字符串。不要切割 error 消息来判断类别，也不要把默认计数当作完整审计记录。</p></details>
    <Script code={item.code}/>
  </>;
}

function SuccessCache() {
  const [selected,setSelected]=useState('same');
  const [ran,setRan]=useState(false);
  const item=data.cache.find(c=>c.id===selected)!;
  return <>
    <div className="project-picker" role="group" aria-label="选择任务编号与实例范围">{data.cache.map(c=><button key={c.id} aria-pressed={selected===c.id} onClick={()=>{setSelected(c.id);setRan(false);}}>{c.label}</button>)}</div>
    <p className="project-prompt">缓存同时记住任务 id、原输入和成功结果。比较“相同请求”“同编号换输入”和“换一个 Processor”。</p>
    <button className="primary" onClick={()=>setRan(true)}>查看调用与成功缓存</button>
    {ran?<div aria-live="polite"><div className="project-observers"><Calls calls={item.calls}/><Cache committed={item.committed} label={selected==='fresh'?'第二个 Processor 实例的缓存':'同一个 Processor 实例的缓存'}/></div><Results items={item.results}/><p className="project-explanation">{selected==='same'?'第二次请求的 id 和输入都一致，返回 cached，不再次调用 worker。':selected==='conflict'?'同一个 id 换了输入，InputError 被记录为 failed；原来的成功缓存没有被覆盖，之后的新任务仍可运行。':'两个新实例各有自己的空缓存，所以同一任务执行了两次。这里没有跨实例、跨进程或跨运行去重。'}</p></div>:<div className="project-wait">先判断实际需要调用几次 worker，再查看记录。</div>}
    <details className="sample-note"><summary>这个缓存不替你保证什么？</summary><p>只有 worker 正常返回，处理器才把结果放入当前实例的内存缓存。结果没有写回输入 JSON，也没有独立结果文件；程序结束后不会持久保存。</p><p>如果 worker 在报错之前已经修改外部状态，成功缓存不能撤销或去重这些副作用。当前默认 worker 只做乘法；扩展真实业务前，要按第十章设计幂等和一致性。</p><p>可选异步 process_group 要求任务编号唯一，一项失败会取消同伴并传播异常组。它没有这里的部分失败 Result、缓存或有限重试契约，不能只换成 async 就当作等价替代。</p></details>
    <Script code={item.code}/>
  </>;
}

function LocalDelivery({packageUrl}:{packageUrl:string}) {
  const [selected,setSelected]=useState('valid');
  const item=data.cli.find(c=>c.id===selected)!;
  const suffix=selected==='invalid'?' python/task_processor/broken_tasks.sample.txt':'';
  return <>
    <div className="project-files"><div><span>实现</span><code>python/task_processor/</code><p>读取、校验、执行与命令行入口</p></div><div><span>验收</span><code>tests/python/test_processor.py</code><p>成功、失败、清理和传播契约</p></div></div>
    <a className="button" href={packageUrl} download="python-course.zip">下载完整配套项目</a>
    <p className="project-prompt">按包内 README 建立环境。在解压目录运行命令，浏览器中的记录供你对照。</p>
    <div className="project-picker" role="group" aria-label="选择CLI固定输入">{data.cli.map(c=><button key={c.id} aria-pressed={selected===c.id} onClick={()=>setSelected(c.id)}>{c.label}</button>)}</div>
    <Code code={'# Windows PowerShell\n.venv/Scripts/python.exe -m python.task_processor'+suffix+'\n\n# macOS / Linux\n.venv/bin/python -m python.task_processor'+suffix} label="终端 · 在项目根目录运行"/>
    <div className="project-cli-observation" aria-live="polite"><div className="project-cli-title"><span className="sample-label">CPython {data.pythonVersion} 预先实际运行的记录</span><strong>退出码 {item.exitCode}</strong></div><div><span className="sample-label">stdout</span><pre>{item.stdout||'（没有结果输出）'}</pre></div>{item.stderrLastLine&&<div><span className="sample-label">stderr 最后一行 · 省略调用帧</span><pre>{item.stderrLastLine}</pre></div>}</div>
    <p className="project-explanation">{selected==='valid'?'CLI 默认读取 sample_tasks.json，用纯计算 worker 把 value 乘以 2；重复的 first 命中缓存。前三节的执行失败由教学脚本注入，不是默认 worker 自己会失败。':'随包 broken_tasks.sample.txt 故意包含损坏的 JSON。CLI 在输入边界返回退出码 2，尚未开始执行任务；终端实际还会显示异常链和 traceback，这里只取最后一行。'}</p>
    <details className="sample-note"><summary>怎样检验自己的修改？</summary><Code code={'# Windows PowerShell\n.venv/Scripts/python.exe -m pytest tests/python/test_processor.py -q\n\n# macOS / Linux\n.venv/bin/python -m pytest tests/python/test_processor.py -q'} label="终端 · 检查真实处理器契约"/><p>改动后在本地实际运行，再对照调用次数、错误类型、原因链、清理与后续任务。网页不会为你没运行的代码显示“测试通过”。</p><p>下一节保留原 run_batch 编程练习及专用测试命令。每个 run_batch 会建立新 Processor，所以它的成功缓存范围是这次调用里的实例。</p></details>
  </>;
}

export default function ChapterTwelve(props:GuidedProps) {
  return <GuidedChapter {...props} subtitle="沿着真实处理器，分清输入被拒绝、单项失败与整个调用中断。" lessons={[
    {label:'输入边界',title:'第一条合法，能先做第一条吗？',intro:'输入先整批校验，执行再逐项隔离；两个边界不能混在一起。',content:<EntryGate/>},
    {label:'执行隔离',title:'第二条失败，第三条还会执行吗？',intro:'同一批任务，比较预期失败、重试耗尽与意外缺陷。',content:<BatchBoundary/>},
    {label:'缓存与结果',title:'同一个编号，就一定能复用结果吗？',intro:'一起核对输入、实例范围和实际调用次数。',content:<SuccessCache/>},
    {label:'本地交付',title:'怎样在自己的机器上验证这套程序？',intro:'从真实入口运行，再用原测试检查处理契约。',content:<LocalDelivery packageUrl={props.packageUrl}/>},
  ]} recap={<div className="sample-recap-grid">{[
    ['先分清拒绝发生在哪一层','整批输入未通过时不启动 worker；执行期只隔离声明的 TaskError，未知错误继续传播。'],
    ['结果说清做到哪一步','done、cached、failed 是明确状态。中断没有返回列表，之前的成功缓存也不会自动回滚。'],
    ['用真实运行验收边界','在本地核对清理、调用次数、异常原因和后续任务。扩展副作用或持久化前，重新设计恢复契约。'],
  ].map(([title,text],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>}/>;
}
