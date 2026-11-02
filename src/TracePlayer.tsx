import { useEffect, useState } from 'react';
import type { Scenario } from './content/schema';
import Code from './Code';
import ExceptionTree from './ExceptionTree';
const eventNames: Record<string,string> = { call: '进入 / 恢复', line: '即将执行', output: '产生输出', exception: '异常事件', return: '离开 / 暂停' };
export default function TracePlayer({ scenarios, reduced, cards = false }: { scenarios: Scenario[]; reduced: boolean; cards?: boolean }) {
  const [selected, setSelected] = useState(scenarios[0]?.id ?? '');
  const scenario = scenarios.find(s => s.id === selected) ?? scenarios[0];
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [prediction, setPrediction] = useState('');
  useEffect(() => { if (reduced) setPlaying(false); }, [reduced]);
  useEffect(() => {
    if (!playing || !scenario || reduced) return;
    const timer = window.setInterval(() => setIndex(prev => Math.min(prev + 1, scenario.steps.length - 1)), 850);
    return () => window.clearInterval(timer);
  }, [playing, scenario, reduced]);
  useEffect(() => { if (scenario && index >= scenario.steps.length - 1) setPlaying(false); }, [index, scenario]);
  if (!scenario) return <p role="status">本章实验数据尚未载入。</p>;
  const step = scenario.steps[index];
  const reset = () => { setIndex(-1); setPlaying(false); };
  return <section className="lab" id="lab" aria-labelledby="lab-title">
    <div className="lab-top"><div><div className="eyebrow">EXECUTION LAB · 有限场景回放</div><h2 id="lab-title">让执行过程看得见</h2></div><span className="version">真实轨迹 · Python {scenario.pythonVersion}</span></div>
    <p className="lab-boundary">这里回放真实 Python 生成的事件；浏览器不执行任意 Python。高亮的 line 事件表示该行执行前，output 事件表示输出已发生。</p>
    <>{cards ? <div className="sample-scene-cards" role="group" aria-label="选择实验场景">{scenarios.map((s,i)=><button key={s.id} data-scenario-id={s.id} aria-pressed={s.id===scenario.id} onClick={()=>{setSelected(s.id);reset();setPrediction('');setRevealed(false);}}><span>实验 0{i+1}</span>{' '}<strong>{s.title}</strong></button>)}</div> : <label className="select-label">选择实验场景<select value={scenario.id} onChange={e => { setSelected(e.target.value); reset(); setPrediction(''); setRevealed(false); }}>{scenarios.map(s => <option value={s.id} key={s.id}>{s.title}</option>)}</select></label>}</>
    <div className="prediction"><h3>{scenario.question}</h3><label htmlFor="prediction">先写下你的预测（自我比对，不自动评分）</label><textarea id="prediction" rows={2} value={prediction} onChange={e => setPrediction(e.target.value)} placeholder="哪些行会执行？最后留下什么？"/><button onClick={() => setRevealed(!revealed)} aria-expanded={revealed}>{revealed ? '收起结果解释' : '查看结果解释'}</button>{revealed && <p className="feedback">{scenario.prediction}</p>}</div>
    <div className="lab-grid"><Code code={scenario.code} line={step?.line} label={'参考脚本 · ' + scenario.id}/>
    <div className="inspector">
      <div className="event-card" aria-live={playing ? 'off' : 'polite'} aria-atomic="true"><span className="event-pill">{step ? eventNames[step.event] ?? step.event : '准备就绪'}</span><h3>{step ? '第 ' + (index + 1) + ' / ' + scenario.steps.length + ' 个事件' : '从第一个事件开始'}</h3><p>{step?.explanation ?? '点击下一步，观察代码、状态和输出如何对应。'}</p></div>
      <div className="stack"><h4>调用栈 <small>从外到内</small></h4>{step?.stack.length ? <ol>{step.stack.map((frame, i) => <li key={i}><code>{frame}</code></li>)}</ol> : <p className="muted">尚无活动帧</p>}</div>
      <div className="runtime-state"><h4>观察到的局部状态</h4>{step && Object.keys(step.state).length ? <dl>{Object.entries(step.state).map(([key,value]) => <div key={key}><dt>{key}</dt><dd><code>{value}</code></dd></div>)}</dl> : <p className="muted">该事件无可展示的局部变量。</p>}</div>
      <div className="output"><h4>标准输出 stdout</h4><pre aria-label="累计标准输出">{step?.output.join('\n') || '（尚无输出）'}</pre></div>
    </div></div>
    {step && <ExceptionTree state={step.state}/>}
    <div className="playback">
      <div className="button-row"><button onClick={() => { setPlaying(false); setIndex(Math.max(-1,index - 1)); }} disabled={index < 0}>上一步</button><button className="primary" onClick={() => { setPlaying(false); setIndex(Math.min(index + 1,scenario.steps.length - 1)); }} disabled={index >= scenario.steps.length - 1}>下一步</button><button onClick={() => { if (index >= scenario.steps.length - 1) setIndex(-1); setPlaying(!playing); }} disabled={reduced}>{playing ? '暂停' : index >= scenario.steps.length - 1 ? '重播' : '播放'}</button><button onClick={reset}>重置实验</button></div>
      <label>事件位置 <input aria-label="事件位置" aria-valuetext={step ? '第 ' + (index + 1) + ' / ' + scenario.steps.length + ' 个事件 · ' + (eventNames[step.event] ?? step.event) : '尚未开始，共 ' + scenario.steps.length + ' 个事件'} type="range" min={-1} max={scenario.steps.length - 1} value={index} onChange={e => { setPlaying(false); setIndex(Number(e.target.value)); }}/><span>{index + 1} / {scenario.steps.length}</span></label>
      {reduced && <small>减少动效已启用，使用逐步操作或下方静态事件列表。</small>}
    </div>
    {index === scenario.steps.length - 1 && <div className={'final-outcome ' + (scenario.exception ? 'review' : 'success')} role="status"><strong>{scenario.exception ? '最终未捕获异常' : '参考脚本执行结束'}</strong><pre>{scenario.exception ?? '未向外抛出异常'}</pre></div>}
    <p className="lab-note">{scenario.notes}</p>
    <details><summary>完整事件列表（静态替代，可直接阅读）</summary><ol className="static-trace">{scenario.steps.map((s,i) => <li key={i}><button className="text-button" onClick={() => { setPlaying(false); setIndex(i); }}>定位事件 {i + 1} · 行 {s.line} · {eventNames[s.event] ?? s.event}</button><p>{s.explanation}</p><div className="trace-meta">栈：{s.stack.join(' → ') || '无'}<br/>输出：{s.output.join(' / ') || '无'}<br/>状态：{JSON.stringify(s.state)}</div></li>)}</ol></details>
  </section>;
}
