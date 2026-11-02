import { useState } from 'react';
import GuidedChapter, { type GuidedProps } from './GuidedChapter';
import Code from './Code';
import data from './data/chaining.json';
import './chaining.css';

function Rethrow() {
  const [mode,setMode]=useState('bare');
  const scene=data.reraises.find(s=>s.id===mode)!;
  return <>
    <div className="chain-switch" role="group" aria-label="选择抛出方式">{[['bare','裸 raise'],['named','raise error'],['translate','转换成 InputError']].map(([id,label])=><button key={id} aria-pressed={mode===id} onClick={()=>setMode(id)}>{label}</button>)}</div>
    <div className="rethrow-route"><div className="exception-object"><span className="sample-label">捕获到的对象</span><strong>ValueError</strong><small>int("bad") 转换失败</small></div><div className="rethrow-action"><code>{mode==='translate'?'raise InputError(...) from error':scene.action}</code><span aria-hidden="true">→</span></div><div className={'exception-object '+(scene.sameObject?'object-same':'object-new')}><span className="sample-label">交给调用者</span><strong>{scene.outer.type}</strong><small>{scene.sameObject?'同一个异常对象':'新对象，保留显式原因'}</small></div></div>
    <div className="rethrow-feedback" role="status"><strong>{mode==='bare'?'原错误继续传播':mode==='named'?'对象没换，追踪位置增加了':'换成上层能理解的类别'}</strong><p>{mode==='bare'?'在 except 中直接写 raise，继续传播当前异常，不额外加入这次重抛的位置。':mode==='named'?'raise error 仍抛出原对象，但 traceback 会多出当前重抛行。只想原样继续时，裸 raise 更直接。':'新 InputError 表达上层契约；from error 把原 ValueError 放进 __cause__，保留诊断线索。'}</p></div>
    <div className="rethrow-frames"><span className="sample-label">这个异常在 parse() 中的 traceback 位置</span>{scene.frames.map((frame,i)=><div key={i}><span>第 {frame.line} 行</span><code>{frame.code}</code></div>)}</div>
    <details className="sample-note"><summary>查看可运行脚本</summary><Code code={scene.code} label="Python 3.11 · 定义后调用 parse()"/><p>示例中的 original_seen 仅用于核对对象身份，业务代码不需要这个全局名字。</p></details>
    <details className="sample-note"><summary>什么时候应该主动 raise？</summary><p>当前函数无法履行约定时，用异常告诉调用者原因。若“没有匹配结果”本来就是正常结果，返回空值可能更清楚。不要为每个普通分支都制造异常。</p></details>
  </>;
}

function ChainViews() {
  const [mode,setMode]=useState('explicit');
  const [view,setView]=useState<'display'|'objects'>('display');
  const scene=data.chains.find(s=>s.id===mode)!;
  return <>
    <div className="chain-switch" role="group" aria-label="异常转换写法">{[['implicit','不写 from'],['explicit','from original'],['hidden','from None']].map(([id,label])=><button key={id} aria-pressed={mode===id} onClick={()=>setMode(id)}><code>{label}</code></button>)}</div>
    <div className="chain-lenses" role="group" aria-label="观察方式"><button aria-pressed={view==='display'} onClick={()=>setView('display')}>看默认展示</button><button aria-pressed={view==='objects'} onClick={()=>setView('objects')}>看对象关系</button></div>
    {view==='display'?<div className="chain-display"><span className="sample-label">默认 traceback 的异常摘要 · 省略调用帧</span><pre aria-label="默认异常摘要">{scene.display.join('\n\n')}</pre><div className="chain-display-foot">{mode==='hidden'?'画面只显示 InputError，旧异常的隐式上下文被隐藏。':mode==='explicit'?'显式原因先显示，再显示上层异常。':'先显示处理中的旧异常，再显示新异常。'}</div></div>:<div className="chain-object-view"><div className="exception-object object-new"><span className="sample-label">新异常</span><strong>{scene.outer.type}</strong><p>{scene.outer.message}</p></div><div className="chain-links"><div><code>__cause__</code><span>{scene.cause?'→ 指向旧对象':'None'}</span></div><div className="context-link"><code>__context__</code><span>→ 仍指向旧对象</span></div><div><code>__suppress_context__</code><span>{String(scene.suppressed)}</span></div></div><div className="exception-object original-object"><span className="sample-label">原异常 · 仍然存在</span><strong>{scene.context?.type}</strong><p>{scene.context?.message}</p></div></div>}
    <p className="chain-keypoint" role="status">{mode==='hidden'?'from None 抑制隐式上下文的默认展示，没有删除 __context__ 里的旧异常。':mode==='explicit'?'from original 明确指定原因；本例 __cause__ 和 __context__ 指向同一个旧异常。':'不写 from 时，Python 自动记录处理期间的异常上下文；本例 __cause__ 是 None。'}</p>
    <details className="sample-note"><summary>查看写法与边界</summary><Code code={scene.code} label="Python 3.11 · 定义后调用 convert()"/><p>显式 __cause__ 存在时优先展示它；没有显式原因且未抑制上下文时，才展示 __context__。from None 不应成为丢掉排错线索的借口，日志也要避免泄露敏感信息。</p></details>
  </>;
}

function Notes() {
  const [mask,setMask]=useState(0);
  const current=data.notes.find(n=>n.id===String(mask))!;
  return <>
    <div className="note-workbench"><div className="note-choices"><span className="sample-label">为同一个异常补充线索</span><label><input type="checkbox" checked={Boolean(mask&1)} onChange={()=>setMask(mask^1)}/><span><strong>是哪一个字段？</strong><code>field=count</code></span></label><label><input type="checkbox" checked={Boolean(mask&2)} onChange={()=>setMask(mask^2)}/><span><strong>是哪一条任务？</strong><code>task id=7</code></span></label><p>选择固定的备注，观察类型和消息有没有改变。</p></div><div className="note-paper"><div className="note-paper-header"><span>异常本身</span><strong>{current.type}</strong><code>{current.message}</code></div><div className="note-paper-body"><span className="sample-label">附加说明 · __notes__</span>{current.notes.length?<ul>{current.notes.map(note=><li key={note}><code>{note}</code></li>)}</ul>:<p>还没有附加说明</p>}</div><div className="note-paper-footer">类型与原消息保持不变</div></div></div>
    <div className="chain-display notes-output"><span className="sample-label">异常摘要的实际输出</span><pre aria-label="备注异常摘要">{current.display}</pre></div>
    <p className="sample-caption">add_note() 从 Python 3.11 开始提供；它追加字符串说明，不改变异常类型和 args。</p>
    <details className="sample-note"><summary>补了备注以后，再包装成新异常呢？</summary><p>备注留在被添加的那个异常对象上。若给 ValueError 添加备注，再用 from 把它包装为 InputError，备注仍保留在 __cause__ 指向的 ValueError 中，并不会自动变成新异常自己的 __notes__。</p><Code code={'try:\n    int("bad")\nexcept ValueError as error:\n    error.add_note("field=count")\n    raise'} label="Python 3.11 · 添加说明后继续传播"/></details>
  </>;
}

export default function ChapterSix(props:GuidedProps) {
  return <GuidedChapter {...props} subtitle="给上层清楚的错误，也给排错的人留下原始线索。" lessons={[
    {label:'抛出与重抛',title:'继续原来的错误，还是换一个类别？',intro:'比较三个写法：对象身份和 traceback 不一定同时保持不变。',content:<Rethrow/>},
    {label:'异常链',title:'看不见旧异常，就等于它不存在吗？',intro:'切换写法，再分别观察默认展示与对象关系。',content:<ChainViews/>},
    {label:'附加线索',title:'不用换类型，能补上一点说明吗？',intro:'给异常贴上字段和任务备注，让下一位排错的人少猜一步。',content:<Notes/>},
  ]} recap={<div className="sample-recap-grid">{[['继续传播','当前 except 中用裸 raise，保留原异常和原始追踪位置。'],['明确原因','需要转换类别时用 raise NewError(...) from original，显式保留原因。'],['补充说明','add_note() 追加诊断文字；from None 只抑制上下文展示，不删除旧对象。']].map(([title,text],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>}/>;
}
