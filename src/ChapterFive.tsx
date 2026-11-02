import { useState } from 'react';
import GuidedChapter, { type GuidedProps } from './GuidedChapter';
import data from './data/hierarchy.json';
import './hierarchy.css';

const descriptions:Record<string,string> = {
  BaseException:'所有内置异常的根；范围包括停止与退出信号。', Exception:'常规应用错误的共同父类。', KeyboardInterrupt:'通常表示用户请求中断。', SystemExit:'表示请求退出程序。', GeneratorExit:'生成器关闭时使用的信号。', ValueError:'类型合适，但值不符合要求，例如 int("pear")。', TypeError:'操作与对象类型不相容。', LookupError:'查找失败的共同父类。', KeyError:'映射中没有所需的键。', IndexError:'序列索引超出范围。', OSError:'操作系统相关失败的共同父类。', FileNotFoundError:'文件或目录不存在。', PermissionError:'操作权限不足。', ArithmeticError:'算术错误的共同父类。', ZeroDivisionError:'除数为零。',
};
const types=data.types;
const matrix=data.matches as Record<string,Record<string,boolean>>;
function path(name:string):string[] {
  const parent=types.find(t=>t.name===name)?.bases[0];
  return parent ? [name,...path(parent)] : [name];
}
function Family() {
  const [selected,setSelected]=useState('LookupError');
  const [family,setFamily]=useState('LookupError');
  const ancestry=path(selected);
  const children=(parent:string)=>types.filter(t=>t.bases.includes(parent)).map(t=>t.name);
  const rootChildren=children('BaseException');
  const ordinary=rootChildren.find(name=>name==='Exception')!;
  const controls=rootChildren.filter(name=>name!==ordinary);
  const families=children(ordinary);
  const familyChildren=children(family);
  const node=(name:string,select:()=>void)=><button key={name} className={'family-node '+(ancestry.includes(name)?'on-path':'')} aria-pressed={selected===name} onClick={select}><code>{name}</code><span>{selected===name?'已选':ancestry.includes(name)?'路径上':'查看'}</span></button>;
  return <><div className="family-diagram" aria-label="异常家谱，点击类型查看路径">
      <div className="family-root">{node('BaseException',()=>setSelected('BaseException'))}</div>
      <div className="family-branches">
        <section className="family-branch"><span className="family-branch-label">常规错误分支</span>{node(ordinary,()=>setSelected(ordinary))}
          <div className="family-tier"><span className="family-tier-label">选择一个类型族</span><div className="family-choices" role="group" aria-label="选择常规错误类型族">{families.map(name=>node(name,()=>{setFamily(name);setSelected(name);} ))}</div></div>
          <div className="family-tier family-descendants"><span className="family-tier-label">{family} 的直接子类</span>{familyChildren.length?<div className="family-choices" role="group" aria-label={`${family} 的直接子类`}>{familyChildren.map(name=>node(name,()=>setSelected(name)))}</div>:<p>本图中没有列出直接子类。</p>}</div>
        </section>
        <section className="family-branch family-controls"><span className="family-branch-label">控制信号分支</span><div className="family-choices" role="group" aria-label="选择控制信号类型">{controls.map(name=>node(name,()=>setSelected(name)))}</div></section>
      </div>
    </div>
    <div className="hierarchy-result" role="status"><span className="sample-label">从所选类型向父类走</span><p className="hierarchy-path">{ancestry.map((name,i)=><span key={name}>{i>0&&<b aria-hidden="true"> → </b>}<code>{name}</code></span>)}</p><p>{descriptions[selected]}</p></div>
    <p className="sample-caption">仅展示常见内置类型的一个子集；箭头指向父类。结构由 CPython 3.11 的 <code>__bases__</code> 生成。</p></>;
}

function Match() {
  const [handler,setHandler]=useState('LookupError');
  return <><p className="sample-prompt">选择一个捕获类型，看看图中哪些异常会匹配。</p><div className="hierarchy-handlers" role="group" aria-label="选择捕获类型">{['LookupError','OSError','Exception','BaseException'].map(h=><button key={h} aria-pressed={handler===h} onClick={()=>setHandler(h)}><code>except {h}:</code></button>)}</div>
    <div className="hierarchy-matches" role="group" aria-label={`${handler} 匹配范围`}>{types.map(t=><div key={t.name} className={matrix[handler][t.name]?'is-match':'not-match'}><code>{t.name}</code><span>{matrix[handler][t.name]?'✓ 匹配':'不匹配'}</span></div>)}</div>
    <p className="sample-caption">匹配依据类身份与继承关系，结果来自 CPython 3.11 的 <code>issubclass</code>。实际执行时，从上到下选择第一个匹配的处理器。</p><details className="sample-note"><summary>同名类与错误消息</summary><p>两个不同的自定义类即使名字相同，也不是同一个类；匹配看类身份及继承关系。不要按异常消息分类：消息可能随版本和上下文变化。</p></details></>;
}
const cases=[
  {name:'ValueError',story:'输入的数字文本无效。',right:0,actions:['提示并要求重新输入','忽略并假装成功','停止整个解释器'],feedback:'如果可以重新输入，就指出值无效；恢复动作仍取决于调用契约。'},
  {name:'TypeError',story:'程序把不支持的对象传给操作。',right:1,actions:['自动改成默认值','报告并检查调用代码','当作用户中断'],feedback:'这可能是调用错误，应保留信息并检查；不要盲目转换或吞掉。'},
  {name:'OSError',story:'读取文件时发生系统错误。',right:2,actions:['所有情况都静默跳过','将所有情况当作输入格式错误','根据具体原因报告或恢复'],feedback:'缺少可选文件可能使用默认值；权限不足通常应报告。只有共同恢复动作适用时才捕获父类。'},
  {name:'KeyboardInterrupt / SystemExit / GeneratorExit',story:'收到中断、退出或生成器关闭信号。',right:1,actions:['转换成普通失败并继续','清理后让信号继续传播','静默忽略所有信号'],feedback:'这些类型不属于 Exception。通常应保留停止或关闭语义；需要清理时可用 finally。'},
];
function Boundary() {
  const [item,setItem]=useState(0); const [answer,setAnswer]=useState<number|null>(null); const current=cases[item];
  return <><div className="hierarchy-cases" role="group" aria-label="选择情境">{cases.map((c,i)=><button key={c.name} aria-pressed={item===i} onClick={()=>{setItem(i);setAnswer(null);}}>{c.name}</button>)}</div><div className="hierarchy-situation"><span className="sample-label">情境 {item+1} / {cases.length}</span><h3>{current.story}</h3><p>在这个情境下，哪种处理更合适？</p><div className="hierarchy-answers">{current.actions.map((a,i)=><button key={a} aria-pressed={answer===i} onClick={()=>setAnswer(i)}>{a}</button>)}</div>{answer!==null&&<div className="hierarchy-result" role="status"><strong>{answer===current.right?'✓ 这个方向合适':'再想一想，仍可以继续或换个选项。'}</strong><p>{current.feedback}</p></div>}</div><p className="sample-caption">这里练习设计判断，不会实际触发中断或退出。具体恢复方式要以程序的职责和契约为准。</p></>;
}
export default function ChapterFive(props:GuidedProps) {
  return <GuidedChapter {...props} subtitle="从异常家谱出发，看清捕获范围，也为停止信号留下通路。" lessons={[
    {label:'异常家谱',title:'这些异常之间是什么关系？',intro:'点选一个类型，沿路径找到它的父类。',content:<Family/>},
    {label:'捕获范围',title:'一个父类会接住哪些异常？',intro:'换一个捕获类型，观察它覆盖的范围。',content:<Match/>},
    {label:'处理边界',title:'接住之后，应该怎么处理？',intro:'选择情境，判断哪里可以恢复，哪里应让信号继续传播。',content:<Boundary/>},
  ]} recap={<><div className="sample-recap-grid">{[['家谱决定匹配','异常类及其子类会匹配对应的 except。'],['范围要和恢复动作相符','共同处理才选择共同父类；不同原因可能需要不同决定。'],['保留停止信号','Exception 不包含 KeyboardInterrupt、SystemExit 和 GeneratorExit。']].map(([title,text],i)=><div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div></>}/>;
}
