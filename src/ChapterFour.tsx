import { useState } from 'react';
import type { Scenario } from './content/schema';
import Code from './Code';
import GuidedChapter, { type GuidedProps } from './GuidedChapter';

const frameNames:Record<string,string>={'<module>':'外层入口',middle:'middle()',leaf:'leaf()'};
const phases=[
  {label:'leaf 抛错',detail:'最内层 leaf 抛出 ValueError，先检查它自己的退出路径。'},
  {label:'leaf 清理',detail:'leaf 的 finally 先执行。清理不会自动处理这个异常。'},
  {label:'到达 middle',detail:'leaf 已退出。异常回到 middle 中调用 leaf() 的位置。'},
  {label:'middle 清理',detail:'middle 也没有匹配的 except，先执行自己的 finally。'},
  {label:'到达外层',detail:'middle 已退出。异常来到最外层调用 middle() 的位置。'},
  {label:'外层捕获',detail:'外层的 except ValueError 匹配成功，异常在这里得到处理。'},
];
function keyEvents(scene:Scenario) {
  const exception=(frame:string)=>scene.steps.findIndex(s=>s.event==='exception'&&s.stack.at(-1)===frame);
  const output=(line:string)=>scene.steps.findIndex(s=>s.event==='output'&&s.output.at(-1)===line);
  return [exception('leaf'),output('leaf cleanup'),exception('middle'),output('middle cleanup'),exception('<module>'),output('outer caught ValueError')];
}

function StackUnwind({scene}:{scene:Scenario}) {
  const [phase,setPhase]=useState(0);
  const step=scene.steps[keyEvents(scene)[phase]];
  const frames=['leaf','middle','<module>'];
  return <>
    <div className="stack-workbench">
      <div className="call-stack-diagram"><div className="stack-direction"><span>最内层</span><span>↓ 异常向调用者传播</span></div>
        {frames.map(frame=>{
          const alive=step.stack.includes(frame);
          const current=step.stack.at(-1)===frame;
          return <div key={frame} className={'call-frame '+(!alive?'frame-exited':current?'frame-current':'frame-waiting')}><div><code>{frameNames[frame]}</code><span>{!alive?'已退出':current?(phase===5?'✓ 已捕获':'当前执行层'):'等待下层调用'}</span></div><p>{frame==='leaf'?(phase>=2?'清理完成，不会自动重试':phase===1?'finally：输出 leaf cleanup':'抛出 ValueError("bad record")'):frame==='middle'?(phase>=4?'清理完成，异常交回入口':phase===3?'finally：输出 middle cleanup':'调用 leaf()，这一行还没正常返回'):(phase===5?'except ValueError 接住异常':'调用 middle()；这里有匹配的 except')}</p></div>;
        })}
      </div>
      <div className="stack-observation"><span className="sample-label">观察异常的位置</span><div className={'exception-orb '+(phase===5?'orb-caught':'')}><span>{phase===5?'已处理':'传播中'}</span><strong>ValueError</strong><code>bad record</code></div><p role="status">{phases[phase].detail}</p><div className="sample-console"><span className="sample-label">累计输出</span><pre aria-label="栈展开输出">{step.output.join('\n')}</pre></div></div>
    </div>
    <div className="unwind-stops" role="group" aria-label="栈展开关键节点">{phases.map((p,i)=><button key={p.label} aria-pressed={phase===i} onClick={()=>setPhase(i)}><span>{i+1}</span>{p.label}</button>)}</div>
    <div className="sample-controls"><button disabled={phase===0} onClick={()=>setPhase(phase-1)}>退一层观察</button><button className="primary" disabled={phase===5} onClick={()=>setPhase(phase+1)}>继续观察</button><button onClick={()=>setPhase(0)}>重新展开</button></div>
    <details className="sample-note"><summary>对照当前代码行</summary><Code code={scene.code} line={step.line} label="Python 3.11 · 真实运行的对应位置"/><p>异常事件表示当前帧已经收到异常；输出事件表示 print 已执行。灰色帧表示它已从当前活动调用栈退出。</p></details>
    <p className="sample-caption">调用栈记录尚未结束的调用。图中不把异常展开产生的 return 事件当成成功返回。</p>
  </>;
}

function TracebackReading({scene}:{scene:Scenario}) {
  const [selected,setSelected]=useState(3);
  const entries=scene.steps.filter(s=>s.event==='exception').slice().reverse();
  const notes=[
    '外层在第14行调用 middle()。这一行出现在 traceback 中，是因为它等待的调用失败了，不说明入口本身一定写错。',
    'middle 在第9行调用 leaf()。顺着调用继续向下找，别停在这个中转位置。',
    'leaf 的第4行抛出 ValueError。这里是本例失败的直接操作，再检查为什么走到了这条语句。',
    '先看末尾的异常类型和消息：ValueError / bad record。它给出调查方向，再往上找具体调用和输入。',
  ];
  return <>
    <div className="traceback-reader"><div className="traceback-caption"><span>本例 traceback 阅读图</span><span>文件路径已省略</span></div>
      {entries.map((entry,i)=><button key={i} aria-pressed={selected===i} onClick={()=>setSelected(i)}><span className="traceback-level">{i+1}</span><span><small>{frameNames[entry.stack.at(-1)!]} · 第 {entry.line} 行</small><code>{scene.code.split('\n')[entry.line-1].trim()}</code></span><span className="traceback-tag">{i===entries.length-1?'失败操作':'调用位置'}</span></button>)}
      <button className="traceback-error" aria-pressed={selected===3} onClick={()=>setSelected(3)}><span className="traceback-level">!</span><strong>ValueError: bad record</strong><span className="traceback-tag">先读这里</span></button>
    </div>
    <div className="traceback-explanation" role="status"><span className="sample-label">你正在读 {selected===3?'异常类型与消息':selected===2?'最深处的失败操作':'调用者的位置'}</span><p>{notes[selected]}</p></div>
    <p className="sample-caption">图中调用点取自真实异常事件。这个脚本最终在外层捕获了异常，因此不会在终端自动打印未捕获 traceback；这里单独画出同一条传播路径供阅读。</p>
    <details className="sample-note"><summary>函数退出了，traceback 还能留着什么？</summary><p>退出的函数不再是活动调用层，但异常的 traceback 仍可能引用帧和局部对象，延长它们的生命周期。要向上层提供任务ID等业务信息，应显式传递或放进异常属性，别把已退出的帧当作业务接口。</p></details>
  </>;
}

function RecoveryBoundary() {
  const [selected,setSelected]=useState<number|null>(null);
  const layers=[{title:'转换函数',role:'知道一个字段为什么转不成整数',action:'继续传播',text:'这里能说明输入哪里错了，却不知道整批任务是否应该继续。没有恢复信息时，让错误交给调用者。'},{title:'文件读取层',role:'负责读取与关闭当前文件',action:'先保证清理',text:'这一层可以关闭文件；关闭成功并不意味着任务已恢复。能否跳过记录，要看它是否拥有相应业务信息。'},{title:'批处理入口',role:'知道任务ID、当前记录和下一条任务',action:'可以决定恢复',text:'这一层有信息记录失败并继续下一条。只捕获它能够处理的错误，其他错误仍应报告或传播。'}];
  return <>
    <p className="sample-prompt">一条记录坏了，谁有信息决定“记下失败，继续下一条”？</p>
    <div className="boundary-layers" role="group" aria-label="选择恢复决策所在层">{layers.map((layer,i)=><button key={layer.title} aria-pressed={selected===i} onClick={()=>setSelected(i)}><span className="boundary-number">0{i+1}</span><strong>{layer.title}</strong><span>{layer.role}</span><b>{selected===i?layer.action:'选择这一层'}</b></button>)}</div>
    {selected!==null&&<div className="traceback-explanation" role="status"><span className="sample-label">{layers[selected].action}</span><p>{layers[selected].text}</p></div>}
    <p className="sample-caption">这是设计判断，选择不会改写上一屏的运行脚本。处理位置取决于谁能恢复，不是固定“越高越好”。</p>
    <details className="sample-note"><summary>已经捕获并记录，还想继续交给上层？</summary><p>在当前 except 中用裸 <code>raise</code> 继续传播，保留原来的 traceback。写 <code>raise err</code> 会从当前行重新抛出，增加一处追踪位置；新建异常则改变了异常对象与可能的因果关系。</p></details>
  </>;
}

export default function ChapterFour(props:GuidedProps) {
  const scene=props.scenarios.find(s=>s.id==='04-stack')!;
  return <GuidedChapter {...props} subtitle="最里面出错，外面为什么还能接住？沿着尚未结束的调用往回看。" lessons={[
    {label:'栈展开',title:'异常怎样一层层回到外面？',intro:'先清理最内层，再回到调用它的地方。点击节点，观察哪一层还在等待。',content:<StackUnwind scene={scene}/>},
    {label:'读 traceback',title:'traceback 里的每一行，都是错误吗？',intro:'从异常类型开始，逐个点开调用位置，找到真正失败的操作。',content:<TracebackReading scene={scene}/>},
    {label:'捕获位置',title:'知道怎么恢复的那一层，在哪里？',intro:'有 except 的位置，不一定就拥有正确的处理办法。',content:<RecoveryBoundary/>},
  ]} recap={<><div className="sample-recap-grid">{[['沿调用返回','当前层没有匹配的处理器，异常就回到调用它的位置。'],['先内后外清理','退出一层前先执行该层 finally，再把异常交给外层。'],['在能恢复处处理','看谁拥有足够的上下文。需要继续传播时，在 except 中用裸 raise。']].map(([title,text],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div><details className="sample-note"><summary>本例那句 unreachable 为什么不执行？</summary><p>leaf() 没有正常返回，middle 中调用它之后的 print 没有机会执行。Python 转去执行 middle 的 finally，然后继续传播；不会自动重跑 leaf。</p></details></>}/>;
}
