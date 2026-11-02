import { useState } from 'react';
import Code from './Code';
import GuidedChapter, { type GuidedProps } from './GuidedChapter';
import data from './data/foundations.json';
import './foundations.css';

function ErrorStage() {
  const [selected,setSelected]=useState('syntax');
  const [prediction,setPrediction]=useState<boolean|null>(null);
  const [revealed,setRevealed]=useState(false);
  const item=data.phases.find(p=>p.id===selected)!;
  const before=item.stdout.includes('before');
  const change=(id:string)=>{setSelected(id);setPrediction(null);setRevealed(false);};
  return <>
    <div className="foundation-picker" role="group" aria-label="选择错误发生阶段">{data.phases.map(p=><button key={p.id} aria-pressed={selected===p.id} onClick={()=>change(p.id)}>{p.label}</button>)}</div>
    <div className="foundation-phase-layout">
      <Code code={item.code} label="Python · 把这段源码作为一整份脚本"/>
      <div className="foundation-stage-observation">
        <p className="sample-prompt">第一行的 <code>before</code> 会打印吗？</p>
        <div className="foundation-prediction" role="group" aria-label="预测第一行输出"><button aria-pressed={prediction===true} onClick={()=>{setPrediction(true);setRevealed(false);}}>会打印</button><button aria-pressed={prediction===false} onClick={()=>{setPrediction(false);setRevealed(false);}}>不会打印</button></div>
        <div className="foundation-pipeline" aria-label="源码的两个阶段">
          <div className={revealed?(item.compiled?'stage-passed':'stage-stopped'):''}><span>01 · 解析与编译</span><strong>{revealed?(item.compiled?'通过':'SyntaxError'):'先检查整份源码'}</strong></div>
          <span aria-hidden="true">↓</span>
          <div className={revealed?(item.compiled?(item.error?'stage-stopped':'stage-passed'):'stage-unreached'):''}><span>02 · 执行语句</span><strong>{revealed?(item.compiled?(item.error?.type??'执行到末尾'):'尚未开始'):'从第一行开始'}</strong></div>
        </div>
        <div className="sample-controls"><button className="primary" onClick={()=>setRevealed(true)}>查看 Python 的实际结果</button><button onClick={()=>{setPrediction(null);setRevealed(false);}}>重置观察</button></div>
      </div>
    </div>
    <div className="foundation-phase-result" aria-live="polite">
      <div className="sample-console"><span className="sample-label">标准输出</span><pre aria-label="脚本标准输出">{revealed?(item.stdout.join('\n')||'（没有输出）'):'（尚未揭示）'}</pre></div>
      <div><span className="sample-label">{revealed?(prediction===null?'实际观察':prediction===before?'预测与结果一致':'再看错误发生的阶段'):'先预测，再核对'}</span><p>{!revealed?'先看第二行，再判断第一行有没有机会执行。':item.stage==='compile'?'整份源码没有通过解析。即使错误在第二行，第一行也没有开始执行。':item.stage==='execute'?'源码合法，第一行已经打印。int("pear") 转换失败，本例没有处理器，后面的 print 不会执行。':'解析通过，转换也成功，两个 print 都执行了。'}</p>{revealed&&item.error&&<code className="foundation-error-summary">{item.error.type}: {item.error.message}</code>}</div>
    </div>
    <details className="sample-note"><summary>SyntaxError 也属于异常，为什么还要分阶段？</summary><p><code>SyntaxError</code> 继承自 <code>Exception</code>。区别是问题在哪个阶段被发现：本例的语法错误阻止整份脚本开始，运行时错误则在执行到具体操作时出现。</p><p>正在运行的外层程序也能对文本调用 <code>compile()</code>，并捕获它抛出的 SyntaxError。上面的数据由这样的外层观察器收集；并非在写坏的源码里放一个 except 就能让它通过解析。交互式逐句输入、导入其他文件，也有各自的编译边界。</p></details>
  </>;
}

const fieldLabels={type:'类型',message:'消息',argsRepr:'args'};
type Field=keyof typeof fieldLabels;
function InspectObject() {
  const [selected,setSelected]=useState('value');
  const [field,setField]=useState<Field>('type');
  const item=data.objects.find(o=>o.id===selected)!;
  const expressions:Record<Field,string>={type:'type(err).__name__',message:'str(err)',argsRepr:'repr(err.args)'};
  return <>
    <div className="foundation-picker" role="group" aria-label="选择要查看的异常">{data.objects.map(o=><button key={o.id} aria-pressed={selected===o.id} onClick={()=>setSelected(o.id)}>{o.label}</button>)}</div>
    <div className="foundation-object-layout">
      <div className="foundation-trigger"><span className="sample-label">执行这个操作，得到异常</span><Code code={item.operation} label="Python · 触发操作摘录，完整脚本在下方"/><p><code>except Exception as err</code> 把捕获到的实例绑定给 <code>err</code>，再查看它的属性。</p><span className="foundation-object-reference">err → 异常实例</span></div>
      <div className="foundation-object-card"><div className="foundation-object-heading"><span>同一个对象的三种观察</span><code>{item.observation.type}</code></div><div className="foundation-fields" role="group" aria-label="选择异常对象字段">{(Object.keys(fieldLabels) as Field[]).map(key=><button key={key} aria-pressed={field===key} onClick={()=>setField(key)}><span>{fieldLabels[key]}</span></button>)}</div><div className="foundation-field-value" aria-live="polite"><code className="foundation-field-expression">{expressions[field]}</code><span className="sample-label">↓ 实际结果 · {fieldLabels[field]}</span><pre aria-label="异常字段值">{item.observation[field]}</pre></div></div>
    </div>
    <p className="foundation-explanation" role="status">{field==='type'?`${item.observation.type} 是异常对象所属类的名字。类型帮助我们辨认失败类别；怎样恢复，还要看调用场景。`:field==='message'?(selected==='key'?'KeyError 的 str(err) 会给缺失的键加引号。消息是展示文本，不能把它当成通用的结构化字段协议。':'str(err) 给出这一次失败的文字细节。消息会随类型和 Python 版本变化，别只靠匹配文字决定处理方式。'):'args 是构造参数的元组，通常由异常类型保存。这里用 repr 展示元组：单个元素后面的逗号也是元组写法。它不保证永远只有一条消息。'}</p>
    <details className="sample-note"><summary>查看这次观察的完整 Python 脚本</summary><Code code={item.code}/><p>这里只用 except 取出对象。处理分支的匹配顺序与范围在第二章展开；自定义异常也可以提供额外属性或改变显示方式。</p></details>
    <details className="sample-note"><summary>还有哪些常见类型？</summary><dl className="foundation-families"><dt>ValueError / TypeError</dt><dd>前者常见于值不满足要求，后者常见于操作与对象类型不相容。</dd><dt>KeyError / IndexError</dt><dd>分别常见于映射中缺键、序列下标越界。</dd><dt>OSError</dt><dd>文件或系统操作失败的一族，如 FileNotFoundError、PermissionError。第五章再看它们的继承关系。</dd></dl><p>类型描述失败条件，不自动给出恢复政策；输入有问题和程序写错，也不能只看一条消息就下结论。</p></details>
  </>;
}

function ReadTraceback() {
  const [selected,setSelected]=useState(-1);
  const trace=data.trace;
  const frame=trace.frames[selected];
  return <>
    <div className="foundation-trace-layout">
      <div className="foundation-trace-paper"><div className="foundation-trace-heading"><span className="sample-label">Traceback · 调用位置从外向内</span><span>chapter01.py</span></div>
        {trace.frames.map((f,i)=><button key={i} className="foundation-trace-frame" aria-pressed={selected===i} onClick={()=>setSelected(i)}><small>第 {f.line} 行 · {f.name}</small><code>{f.source.trim()}</code><span>{i===trace.frames.length-1?'失败操作':'调用位置'}</span></button>)}
        <button className="foundation-trace-error" aria-pressed={selected===-1} onClick={()=>setSelected(-1)}><small>先读最后的异常行</small><strong>{trace.type}</strong><code>{trace.message}</code></button>
      </div>
      <div className="foundation-trace-guide" role="status"><span className="sample-label">{selected===-1?'01 · 看失败类别':selected===trace.frames.length-1?'02 · 找直接失败的操作':'03 · 追输入来自哪里'}</span><h3>{selected===-1?'先确认出了什么问题':selected===trace.frames.length-1?'int(text) 收到了什么？':'这一行在调用下一层'}</h3><p>{selected===-1?'末尾的 ValueError 和消息提示整数转换失败。接着点上方最深处的失败操作，别把整段 traceback 当成一条消息。':selected===trace.frames.length-1?'这里执行整数转换，传入的 "pear" 无法转成整数。定位到操作后，还要调查输入为什么来到这里。':'入口把 "pear" 交给 parse_count。调用位置出现在回溯中，说明这次调用失败；它本身不一定有 bug。'}</p><button onClick={()=>setSelected(-1)}>从异常行重新读</button></div>
    </div>
    <details className="sample-note foundation-trace-source"><summary>对照这次回溯的完整源码{frame?` · 当前第 ${frame.line} 行`:''}</summary><Code code={trace.code} line={frame?.line} label="Python · 捕获后查看真实 traceback"/></details>
    <p className="sample-caption">异常被捕获后，仍可查看它的调用位置。第四、九章继续学习传播和诊断。</p>
    <details className="sample-note"><summary>查看 Python 格式化的完整回溯</summary><pre className="foundation-formatted">{trace.formatted}</pre><p>由 <code>traceback.format_exception(err)</code> 生成；本例末尾给出异常类型与消息。真实程序还可能有异常链、备注或异常组，后面分别学习。</p></details>
  </>;
}

export default function ChapterOne(props:GuidedProps) {
  return <GuidedChapter {...props} subtitle="先看错误在哪个阶段发生，再拆开异常对象，读懂它留下的调用线索。" lessons={[
    {label:'错误发生阶段',title:'第二行写错，第一行会打印吗？',intro:'先分清整份源码没有通过解析，还是某个操作在运行时失败。',content:<ErrorStage/>},
    {label:'异常对象',title:'报错是一段文字，还是一个对象？',intro:'换三个触发操作，用类型、消息和 args 观察同一个异常实例。',content:<InspectObject/>},
    {label:'读第一条回溯',title:'从一条 traceback 里，先看哪里？',intro:'先看末尾的异常，再找失败操作，最后顺着调用检查输入。',content:<ReadTraceback/>},
  ]} recap={<><div className="sample-recap-grid">{[['先判断阶段','整份脚本解析失败时还没有开始执行；运行时异常发生在某个操作执行期间。'],['把对象与显示分开','type 看类型，str 看消息，args 保存构造参数；消息不是完整的 traceback。'],['按线索调查','先看异常行，再找最深处的应用代码操作，沿调用确认输入。调用者出现不等于它有 bug。']].map(([title,text],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div><details className="sample-note"><summary>发生异常后，程序会自动重试吗？</summary><p>不会。没有匹配的处理器时，异常继续传播；捕获后执行处理分支，也不会自动回到失败语句。第二章接着看捕获后会走到哪里。</p></details></>}/>;
}
