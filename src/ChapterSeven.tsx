import { useState } from 'react';
import GuidedChapter, { type GuidedProps } from './GuidedChapter';
import Code from './Code';
import data from './data/contracts.json';
import './contracts.css';

type Mode = 'normal' | 'counter';
type Case = typeof data.cases[number];
type Outcome = Case['normal'];
const getCase = (id: string) => data.cases.find(c => c.id === id)!;

function Boundary() {
  const [selected, setSelected] = useState('bad_json');
  const item = getCase(selected);
  const outcome = item.normal;
  const returned = outcome.kind === 'returned';
  return <>
    <p className="contract-definition">这里的 API 指函数向调用者提供的接口，不要求使用 Web 框架。</p>
    <div className="contract-picker" role="group" aria-label="观察接口边界">{['valid','bad_json','bug'].map(id => <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}>{getCase(id).label}</button>)}</div>
    <div className="contract-route" aria-label="从实现内部到调用者">
      <div className="contract-station"><span className="sample-label">01 · 实现内部</span><strong>{returned ? '读入整数' : outcome.cause?.type || outcome.error?.type}</strong><code>{item.text}</code><p>{returned ? '取出 value，再乘以 2。' : selected === 'bad_json' ? 'JSON 解析器发现格式损坏。' : '程序把整数与字符串相加。'}</p></div>
      <span className="contract-arrow" aria-hidden="true">→</span>
      <div className="contract-station contract-border"><span className="sample-label">02 · 公开边界</span><strong>{returned ? '返回结果' : outcome.expected ? '转换已知失败' : '保留意外错误'}</strong><code>{returned ? `return ${outcome.value}` : outcome.expected ? 'raise TaskInputError(...) from original' : 'TypeError 继续传播'}</code><p>{returned ? '成功结果是一项整数。' : outcome.expected ? '调用者依赖领域异常，原始原因留在 cause 中。' : '没有把程序缺陷伪装成输入问题。'}</p></div>
      <span className="contract-arrow" aria-hidden="true">→</span>
      <div className="contract-station"><span className="sample-label">03 · 调用者</span><strong>{returned ? '使用结果' : outcome.expected ? '提示修改输入' : '报告并排查'}</strong><code>{returned ? String(outcome.value) : outcome.error?.type}</code><p>{returned ? '只有正常返回后，才使用结果。' : outcome.expected ? '按异常类型决定动作，不解析错误文案。' : '由合适的外层记录或报告，不能假装成功。'}</p></div>
    </div>
    <p className="contract-takeaway" role="status">{returned ? '契约同时说明成功返回值和失败行为。' : outcome.expected ? '底层可以更换 JSON 实现；调用者仍处理公开的 TaskInputError。' : '本例只转换已知的解析失败；TypeError 不在恢复契约中。'}</p>
    <details className="sample-note"><summary>异常类型要拆得多细？</summary><p>当调用者需要采取不同动作时，再增加子类。TaskError 可以统一表示预期任务失败，TaskInputError 专门表示输入问题。仅仅改一句消息，不必再建一个类。</p><p>类名和继承关系只是接口的一部分；哪些输入被拒绝、哪些异常会传播，也要写清楚。</p></details>
  </>;
}

const initialRecord = () => ({ caseId: 'bad_json', ran: false, runs: 0 });
const initialRecords = () => ({ normal: initialRecord(), counter: initialRecord() });
function verdict(outcome: Outcome) {
  return outcome.kind === 'returned' ? `正常返回 ${outcome.value}` : `抛出 ${outcome.error?.type}`;
}
function CounterexampleLab() {
  const [mode, setMode] = useState<Mode>('normal');
  const [records, setRecords] = useState(initialRecords);
  const current = records[mode];
  const item = getCase(current.caseId);
  const outcome = item[mode];
  const swallowed = mode === 'counter' && item.normal.kind === 'raised';
  const update = (next: Partial<typeof current>) => setRecords(old => ({...old, [mode]: {...old[mode], ...next}}));
  const fullCode = data.definitions + '\n' + data.wrappers[mode] + `\nprint(submit(${JSON.stringify(item.text)}, bug=${item.bug ? 'True' : 'False'}))`;
  return <>
    <div className={'contract-lab ' + (mode === 'counter' ? 'counterexample-on' : '')}>
      <div className="contract-lab-heading"><div><span className="sample-label">同一输入 · 两种处理</span><h3>返回 0，就代表做完了吗？</h3></div><span className="contract-mode" role="status">{mode === 'normal' ? '正常实验' : '反例模式 · 故意吞错'}</span></div>
      <div className="contract-picker contract-inputs" role="group" aria-label="选择固定任务输入">{data.cases.map(c => <button key={c.id} aria-pressed={current.caseId === c.id} onClick={() => update({caseId:c.id, ran:false})}>{c.label}</button>)}</div>
      <div className="contract-bench">
        <div><div className="contract-input"><span className="sample-label">交给 submit 的输入</span><code>{item.text}</code>{item.bug && <p>本例额外执行错误语句 <code>value + "units"</code>。</p>}</div><Code code={data.wrappers[mode]} label="Python 片段 · run_job 定义见下方完整脚本"/><button className="primary" onClick={() => update({ran:true, runs:current.runs+1})}>运行这个输入</button><span className="contract-run-count">本模式已运行 {current.runs} 次</span></div>
        <div className="contract-result" aria-live="polite"><span className="sample-label">外层观察到的结果</span>{current.ran ? <><h4>{verdict(outcome)}</h4>{outcome.kind === 'returned' ? <div className="contract-return"><strong>{outcome.value}</strong><span>返回值 · int</span></div> : <dl><dt>type</dt><dd>{outcome.error?.type}</dd><dt>field</dt><dd>{outcome.field || '无'}</dd><dt>cause</dt><dd>{outcome.cause?.type || '无显式原因'}</dd></dl>}<p className="contract-verdict">{swallowed ? '错误被吃掉了。调用者拿到 0，无法与一次合法的零结果区分。' : outcome.kind === 'returned' ? '这次输入确实完成了运算。' : outcome.expected ? '调用者收到明确的输入失败，可以提示修改。' : '意外的程序错误继续传播，留给外层诊断。'}</p>{swallowed && <p className="contract-compare">同一输入的正常版本抛出 <strong>{item.normal.error?.type}</strong>；错误副本没有报告它。</p>}</> : <div className="contract-wait"><span aria-hidden="true">↳</span><p>先选输入，再运行。<br/>观察这里收到值，还是异常。</p></div>}</div>
      </div>
      <details className="counterexample-switch"><summary>试试错误写法：把所有失败变成 0</summary><p>开关切换到另一份教学状态；关闭后回到原来的正常实验。</p><label><input type="checkbox" checked={mode === 'counter'} onChange={e => setMode(e.target.checked ? 'counter' : 'normal')}/>进入错误副本：except Exception 后返回 0</label><p>这段代码同时吞掉输入错误与程序缺陷。</p></details>
      <button className="contract-reset" onClick={() => {setRecords(initialRecords());setMode('normal');}}>重置两份实验</button>
      </div>
    <details className="sample-note"><summary>推荐实验顺序与每一步的理由</summary><ol><li>正常模式运行“损坏的 JSON”：看到 TaskInputError 和原始原因。</li><li>打开错误副本，运行相同输入：异常消失，返回 0。</li><li>在副本运行“合法的 0”：结果也为 0，发现调用者已经无法区分。</li><li>试“内部代码写错”，再关闭副本：观察 TypeError 是否被掩盖；正常模式保留上次状态，可重新选择同一输入对照。</li></ol></details>
    <details className="sample-note"><summary>查看当前案例的完整 Python 脚本</summary><Code code={fullCode}/><p>脚本直接打印返回值；未捕获异常时，终端会显示 traceback。网页只展示外层观察到的异常摘要。</p></details>
    <details className="sample-note"><summary>用默认值恢复，什么时候才合理？</summary><p>只有接口明确约定这种失败允许降级，并且调用者能正确理解结果时，才使用默认值。本例没有这个约定；把任意失败都变成整数 0，会抹掉调用者需要的信息。</p><p>捕获 Exception 本身不等于吞错；记录、报告或重新抛出都可能合理。问题在于不区分原因便返回一个看似成功的值。</p></details>
  </>;
}

function StructuredError() {
  const [locale, setLocale] = useState(0);
  const error = data.fields[locale];
  return <>
    <div className="contract-picker" role="group" aria-label="切换错误消息">{['英文消息','中文消息'].map((label,i) => <button key={label} aria-pressed={locale === i} onClick={() => setLocale(i)}>{label}</button>)}</div>
    <div className="contract-error-card"><div className="contract-error-title"><span className="sample-label">同一种领域异常</span><strong>{error.type}</strong><small>Exception → TaskError → TaskInputError（父类到子类）</small></div><div className="contract-message"><span className="sample-label">给人看的消息 · str(error)</span><p>{error.message}</p></div><div className="contract-fields"><div><span>task_id</span><code>{error.taskId}</code></div><div><span>field</span><code>{error.field}</code></div></div></div>
    <div className="contract-field-action" role="status"><span className="sample-label">调用者读取 error.field</span><div><span>value</span><strong>请检查这个字段</strong></div><p>消息换了语言，定位的字段仍然是 <code>value</code>。</p></div>
    <details className="sample-note"><summary>查看异常类与调用方写法</summary><Code code={data.definitions.slice(data.definitions.indexOf('class TaskError'),data.definitions.indexOf('def load_value'))} label="Python · 可独立定义的领域异常类"/><Code code={'# 教学片段：submit、text 与 highlight_field 由应用提供\ntry:\n    result = submit(text)\nexcept TaskInputError as error:\n    highlight_field(error.field)'} label="Python 片段 · 调用者按类型与属性处理"/><p>super().__init__(message) 保存消息；task_id 和 field 是这个接口承诺的属性。对象保持简单，不放完整任务、共享可变数据或秘密字段。</p><p>本节 TaskInputError 是独立教学类；配套项目使用较简洁的 InputError。相似的名字不代表同一个类。</p></details>
    <p className="contract-takeaway">给程序稳定的属性，给人自然的说明；不要从一句消息里切出业务字段。</p>
  </>;
}

export default function ChapterSeven(props: GuidedProps) {
  return <GuidedChapter {...props} subtitle="把失败讲清楚，让调用者知道下一步能做什么。" lessons={[
    {label:'接口边界',title:'调用者应该依赖哪一种错误？',intro:'成功返回什么，失败交出什么，都是函数的承诺。',content:<Boundary/>},
    {label:'正常与反例',title:'错误消失了，任务就成功了吗？',intro:'切换一处处理代码，看调用者失去了什么信息。',content:<CounterexampleLab/>},
    {label:'结构化异常',title:'换一句消息，程序还认得出问题吗？',intro:'切换消息语言，观察程序依赖的字段是否改变。',content:<StructuredError/>},
  ]} recap={<div className="sample-recap-grid">{[['边界有承诺','文档写清返回值、预期异常和传播边界；已知失败可转换，意外缺陷保留诊断信息。'],['分类服务于动作','从 Exception 继承，用父类处理共同失败；调用者需要不同动作时再拆子类。'],['属性承担接口','消息可以改写；task_id、field 等属性供程序读取。别用成功值偷偷替换失败。']].map(([title,text],i) => <div key={title}><span>0{i+1}</span><h3>{title}</h3><p>{text}</p></div>)}</div>}/>;
}
