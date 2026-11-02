import { Fragment, useMemo } from 'react';
import { pythonLines } from './pythonHighlight';
export function Inline({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/g).map((part, i) => part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : <Fragment key={i}>{part}</Fragment>)}</>;
}
export default function Code({ code, line, label = 'Python' }: { code: string; line?: number; label?: string }) {
  const highlighted = useMemo(() => pythonLines(code, !label.startsWith('终端')), [code, label]);
  return <div className="codebox"><div className="code-label">{label}</div><pre tabIndex={0} aria-label={label}><code>{highlighted.map((pieces, i) => <span key={i} className={'code-line' + (line === i + 1 ? ' active-line' : '')} aria-current={line === i + 1 ? 'step' : undefined}><span className="line-number" aria-hidden="true">{i + 1}</span><span className="code-source">{pieces.length ? pieces.map((piece, j) => <span key={j} className={piece.kind ? 'syntax-' + piece.kind : undefined}>{piece.text}</span>) : ' '}</span>{line === i + 1 && <span className="line-marker" aria-label="当前事件行"> ◀</span>}</span>)}</code></pre></div>;
}
