import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import hierarchy from './data/hierarchy.json';

export type CodePiece = { text: string; kind: string };
// Teaching landmarks, not a claim to infer runtime types or variable scope.
const landmarks = new Set(['mode', 'result', 'original', 'error', 'err', 'exc', 'mapping', 'key', 'default', 'count', 'value']);

export function pythonLines(code: string, enabled = true): CodePiece[][] {
  if (!enabled) return code.split('\n').map(text => [{ text, kind: '' }]);
  const tokens = Prism.tokenize(code, Prism.languages.python);
  const functions = new Set<string>(['add_note']);
  const classes = new Set([...hierarchy.types.map(t => t.name), 'RuntimeError']);
  const collect = (token: string | Prism.Token) => {
    if (typeof token === 'string') return;
    if (token.type === 'function' && typeof token.content === 'string') functions.add(token.content);
    if (token.type === 'class-name' && typeof token.content === 'string') classes.add(token.content);
    if (Array.isArray(token.content)) token.content.forEach(collect);
  };
  tokens.forEach(collect);
  const lines: CodePiece[][] = [[]];
  const append = (text: string, kind: string) => {
    text.split('\n').forEach((part, i) => {
      if (i) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, kind });
    });
  };
  const visit = (token: string | Prism.Token, inherited = '') => {
    if (typeof token === 'string') {
      if (inherited) { append(token, inherited); return; }
      token.split(/([A-Za-z_]\w*)/g).forEach(word => append(word,
        classes.has(word) ? 'class-name' : functions.has(word) ? 'function' : landmarks.has(word) ? 'landmark' : ''));
      return;
    }
    const content = token.content;
    const kind = token.type === 'keyword' && content === 'print' ? 'builtin' : token.type;
    if (Array.isArray(content)) content.forEach(part => visit(part, kind));
    else visit(content, kind);
  };
  tokens.forEach(token => visit(token));
  return lines;
}
