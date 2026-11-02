import { useState } from 'react';
import type { Quiz as QuizData } from './content/schema';
import type { AnswerRecord } from './progress';
import Code, { Inline } from './Code';
export default function Quiz({ quiz, record, onAnswer }: { quiz: QuizData; record?: AnswerRecord; onAnswer: (correct: boolean, hint: boolean) => void }) {
  const [choice, setChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [hints, setHints] = useState(0);
  const kind = { predict: '运行预测', analyze: '分析与迁移', quiz: '章节测验' }[quiz.kind];
  return <article className="quiz" aria-labelledby={quiz.id + '-title'}>
    <div className="eyebrow">{kind} · {quiz.knowledge}</div>
    <h3 id={quiz.id + '-title'}><Inline text={quiz.question}/></h3>
    {quiz.code && <Code code={quiz.code} label="阅读代码 · 先独立判断"/>}
    <fieldset disabled={submitted}><legend className="sr-only">{quiz.question}</legend>{quiz.options.map((option, index) => <label className={'option' + (choice === index ? ' selected' : '')} key={index}><input type="radio" name={quiz.id} value={index} checked={choice === index} onChange={() => setChoice(index)}/><span><Inline text={option}/></span></label>)}</fieldset>
    <div className="button-row">
      <button className="primary" disabled={choice === null || submitted} onClick={() => { if (choice !== null) { setSubmitted(true); onAnswer(choice === quiz.answer, hints > 0); } }}>检查答案</button>
      {hints < quiz.hints.length && !submitted && <button onClick={() => setHints(hints + 1)}>提示 {hints + 1}/{quiz.hints.length}</button>}
      {submitted && <button onClick={() => { setSubmitted(false); setChoice(null); setHints(0); }}>重新作答</button>}
      <small>{record ? '已作答 ' + record.attempts + ' 次 · 答对 ' + record.correctAttempts + ' 次' : '尚未作答'}</small>
    </div>
    {hints > 0 && <ol className="hint">{quiz.hints.slice(0, hints).map(h => <li key={h}><Inline text={h}/></li>)}</ol>}
    {submitted && <div className={'feedback ' + (choice === quiz.answer ? 'success' : 'review')} role="status"><strong>{choice === quiz.answer ? '✓ 判断正确' : '↺ 再检查这条执行路径'}</strong><p><Inline text={quiz.explanation}/></p>{hints > 0 && <p>本次使用了提示。理解后可以重新独立作答。</p>}</div>}
  </article>;
}
