import { useState } from 'react';
import Code from './Code';
import GuidedChapter, { type GuidedProps } from './GuidedChapter';
import data from './data/diagnostics.json';
import './diagnostics.css';

function LocateFailure() {
  const [selected,setSelected]=useState(-1);
  const trace=data.trace;
  const frame=trace.frames[selected];
  const deepest=selected===trace.frames.length-1;
  return <>
    <div className="diagnostic-reader">
      <div className="diagnostic-paper"><div className="diagnostic-paper-heading"><span className="sample-label">本次异常 · 从外向内的调用位置</span><small>文件路径省略</small></div>
        <div className="diagnostic-frames" role="group" aria-label="点读异常回溯">{trace.frames.map((f,i)=><button key={i} aria-pressed={selected===i} onClick={()=>setSelected(i)}><span className="diagnostic-frame-no">{i+1}</span><span><small>{f.function} · 第 {f.line} 行</small><code>{f.source.trim()}</code></span><b>{i===trace.frames.length-1?'失败操作':'调用位置'}</b></button>)}</div>
        <button className="diagnostic-error-line" aria-pressed={selected===-1} onClick={()=>setSelected(-1)}><span className="sample-label">先看异常类型与消息</span><strong>{trace.type}</strong><code>{trace.message}</code></button>
      </div>
      <div className="diagnostic-source"><Code code={trace.code} line={frame?.line} label="Python · 这次异常的对应源码"/></div>
    </div>
    <div className="diagnostic-explanation" role="status"><span className="sample-label">{!frame?'调查起点':deepest?'找到直接失败的操作':'沿着调用继续找'}</span><p>{!frame?'ValueError 提示值无法按要求转换。接下来点最深处的调用帧，确认哪项操作失败。':deepest?`这里执行 ${frame.source.trim()}，整数转换失败。检查传入的文本从哪里来，再决定校验或恢复放在哪一层。`:`${frame.function} 中的这一行调用了更深层函数。它出现在 traceback 中，说明等待的调用失败；还要继续向内查看，不能仅凭这一行断定问题所在。`}</p></div>
    <button className="diagnostic-reset" onClick={()=>setSelected(-1)}>回到异常摘要</button>
    <p className="sample-caption">帧和行号来自真实异常的 __traceback__。脚本由外层观察器捕获，这里展示阅读图；行号用于定位本例，不作为稳定测试契约。</p>
    <details className="sample-note"><summary>定位之后，还需要记录什么？</summary><p>记录任务标识、执行阶段和异常类别，才知道哪次操作需要复现。不要把完整任务、令牌或个人数据直接写入日志。</p><p>traceback 描述传播路径，异常类型与消息提供调查方向；它们本身不能证明应该重试。后续动作仍要看输入与业务约定。</p></details>
  </>;
}

function LoggingEvidence() {
  const [selected,setSelected]=useState('message');
  const [revealed,setRevealed]=useState(false);
  const item=data.logs.find(l=>l.id===selected)!;
  const excerpt=item.code.split('\n').filter(line=>line.trim().startsWith('logger.')||line.trim()==='raise').map(line=>'    '+line.trim().replace('("task_id=', '(\n        "task_id=').replace(', "job-9"', ',\n        "job-9"').replace(', error)', ', error\n    )').replace(', "parse")', ', "parse"\n    )')).join('\n');
  return <>
    <div className="diagnostic-picker" role="group" aria-label="选择日志处理方式">{data.logs.map(l=><button key={l.id} aria-pressed={selected===l.id} onClick={()=>{setSelected(l.id);setRevealed(false);}}>{l.label}</button>)}</div>
    <div className="diagnostic-log-layout"><div><div className="diagnostic-context"><span className="sample-label">同一次转换失败 · 固定任务上下文</span><dl><dt>task_id</dt><dd>job-9</dd><dt>phase</dt><dd>parse</dd></dl></div><Code code={'# 已在 except 中捕获转换异常\n'+excerpt} label="Python 处理器摘录 · 定义和日志配置可展开查看"/><button className="primary" onClick={()=>setRevealed(true)}>查看这次记录</button></div>
      <div className="diagnostic-record" aria-live="polite"><span className="sample-label">日志记录包含的线索</span><dl><div><dt>日志消息</dt><dd>{revealed?item.message:'待观察'}</dd></div><div><dt>异常信息 exc_info</dt><dd>{revealed?(item.hasExcInfo?'有 · 类型、实例与 traceback':'无 · 只有消息文本'):'待观察'}</dd></div><div><dt>外层收到异常？</dt><dd>{revealed?(item.propagated?'是，裸 raise 继续传播':'否，本例的 except 处理后继续'):'待观察'}</dd></div></dl><div className="diagnostic-record-end">{revealed?(item.afterHandler?'执行了处理器之后的代码':'没有执行处理器之后的代码'):'记录日志，会自动继续传播吗？'}</div></div>
    </div>
    {revealed&&<><p className="diagnostic-explanation" role="status">{!item.hasExcInfo?'str(error) 留下消息，但没有把 traceback 作为异常信息交给日志。仅凭这一条消息，很难知道失败经过了哪些调用。':item.propagated?'同一条日志保留了异常现场；随后裸 raise 把异常继续交给外层。记录与传播是两个动作。':'logger.exception 保留当前异常信息，本身不重新抛出异常。这个例子仍会在 except 结束后继续。'}</p><details className="sample-note diagnostic-formatted"><summary>展开这条日志的实际格式化结果</summary><pre>{item.formatted}</pre><p>使用确定的教学文件名；这是本次 Handler 和 Formatter 的输出，不代表所有应用都采用相同日志格式。</p></details></>}
    <details className="sample-note"><summary>推荐比较顺序</summary><ol><li>先看“只记消息”：知道发生了什么，却缺少调用位置。</li><li>换成“保留异常现场”：比较 exc_info，再展开格式化结果。</li><li>最后看“记录后传播”：日志仍在，外层却收到了异常，说明记录本身不决定恢复。</li></ol></details>
    <details className="sample-note"><summary>配置和边界：为什么没看到日志？</summary><p>本例已配置可接收 ERROR 的 logger、Handler 和 Formatter。真实应用还要检查日志级别、输出位置和传播配置；调用 logger.exception 不保证记录一定显示出来。</p><p>logger.exception 通常在 except 中使用，以取得正在处理的异常。logger.error(..., exc_info=True) 也可附加当前异常信息；普通的 logger.error(str(error)) 没有这个开关。</p><p>记录和恢复要分别设计；选择一个合适的边界记录，避免沿途每一层都重复打印同一条 traceback。</p></details>
    <details className="sample-note"><summary>查看当前日志片段与本地运行方式</summary><Code code={'import logging\n\nlogging.basicConfig(\n    level=logging.ERROR,\n    format="%(levelname)s:%(message)s"\n)\nlogger = logging.getLogger("chapter09")\n\n'+item.code}/><p>重抛版会在日志后继续向外抛出异常。</p></details>
  </>;
}

function ContractTests() {
  const [implementation,setImplementation]=useState('cause-bug');
  const [suite,setSuite]=useState('type');
  const [revealed,setRevealed]=useState(false);
  const impl=data.testing.implementations.find(i=>i.id===implementation)!;
  const checks=data.testing.suites.find(s=>s.id===suite)!;
  const result=data.testing.results.find(r=>r.implementation===implementation&&r.suite===suite)!;
  const missed=implementation!=='correct'&&result.failed===0;
  const fullCode=data.testing.definition+'\n'+impl.code+'\n'+checks.code;
  return <>
    <p className="diagnostic-prompt">read_count 承诺：只接收字符串；坏文本抛 TaskInputError，保留 task_id 和显式原因链。</p>
    <div className="diagnostic-test-suites" role="group" aria-label="选择测试覆盖范围">{data.testing.suites.map((s,i)=><button key={s.id} aria-pressed={suite===s.id} onClick={()=>{setSuite(s.id);setRevealed(false);}}><span>0{i+1}</span><strong>{s.label}</strong><small>{s.id==='success'?'只看一次正常返回':s.id==='type'?'只看坏文本的异常类型':'成功、原因链与边界输入'}</small></button>)}</div>
    <div className="diagnostic-picker diagnostic-implementations" role="group" aria-label="选择待验证的固定实现">{data.testing.implementations.map(i=><button key={i.id} aria-pressed={implementation===i.id} onClick={()=>{setImplementation(i.id);setRevealed(false);}}>{i.label}</button>)}</div>
    <div className="diagnostic-test-layout"><div><Code code={checks.code} label="Python · 当前测试，read_count 与异常类由下方定义提供"/><button className="primary" onClick={()=>setRevealed(true)}>查看这组验证结果</button></div><div className={'diagnostic-test-result '+(revealed&&result.failed?'diagnostic-test-failed':'')} aria-live="polite"><span className="sample-label">预先运行的真实 pytest 结果</span>{revealed?<><h3>{result.failed?'发现契约被破坏':missed?'测试通过，但漏掉了错误':'当前检查全部通过'}</h3><div className="diagnostic-test-counts"><div><strong>{result.passed}</strong><span>通过</span></div><div><strong>{result.failed}</strong><span>失败</span></div></div><p>{result.failed?(implementation==='bool-bug'?'True 被当成 1 接受；边界输入测试发现了遗漏。':'异常类型正确，但 __cause__ 丢失；原因链断言发现了问题。'):missed?(suite==='success'?'只验证了合法输入，无法约束错误路径。':'只验证异常类别，没有检查原因链或非字符串输入。'):'测试只保证已经断言的这些行为；仍要根据接口约定选择有意义的成功与失败样本。'}</p><small>pytest 退出码 {result.exitCode}</small></>:<div className="diagnostic-test-wait">选一套测试，看看它能发现哪种错误。</div>}</div></div>
    <p className="sample-caption">3 种实现 × 3 套测试。这里查看已有测试结果；编程练习请在本地运行。</p>
    <details className="sample-note"><summary>查看当前实现与完整测试文件</summary><Code code={fullCode}/><p>保存为 test_sample.py，安装配套 requirements.txt 后，在本地用 <code>python -m pytest test_sample.py -q</code> 验证。标为错误的实现专供比较；完整契约测试应当指出它的问题。</p></details>
    <details className="sample-note"><summary>pytest.raises 的范围要放在哪里？</summary><p>只把预期抛错的操作放进 with pytest.raises(...) 中。异常发生后的语句不会继续执行，因此对 exc_info.value 的断言要放在 with 外。</p><p>pytest.raises(ExpectedError) 接受该类型及其子类；若接口必须是精确类型，再用 type(exc_info.value) is ExpectedError 断言。match 参数按正则匹配消息；普通消息片段包含正则符号时，可用 re.escape。</p><p>不要逐字断言本机路径、源码行号或整段 traceback。优先检查异常类型、公开属性、明确的原因链；日志可用 caplog 检查记录的 exc_info。</p></details>
  </>;
}

export default function ChapterNine(props:GuidedProps) {
  return <GuidedChapter {...props} subtitle="先找到失败操作，再留下诊断线索，用测试守住处理约定。" lessons={[
    {label:'定位失败',title:'traceback 这么长，从哪里开始查？',intro:'先看末尾的类型和消息，再沿调用找到直接失败的操作。',content:<LocateFailure/>},
    {label:'记录现场',title:'记下错误消息，线索就够了吗？',intro:'同一次失败，比较消息文本、异常现场与继续传播。',content:<LoggingEvidence/>},
    {label:'验证契约',title:'测试通过，就能说明错误处理正确吗？',intro:'改变测试范围，观察同一个错误实现怎样被漏掉或发现。',content:<ContractTests/>},
  ]} recap={<div className="sample-recap-grid">{[
    ['先定位，再调查','类型和消息给出方向，最深的相关应用帧指出失败操作；继续核对输入与业务上下文。'],
    ['记录不等于恢复','except 内的 logger.exception 可保留异常信息。是否继续传播，由 raise 和处理契约决定。'],
    ['测试守住约定','成功样本和错误路径一起验证；检查类型、属性与原因链，不绑定本机 traceback 排版。'],
  ].map(([title,text],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>}/>;
}
