import { describe, it, expect } from 'vitest';
import { pythonLines } from '../../src/pythonHighlight';
import traces from '../../src/data/traces.json';
import chaining from '../../src/data/chaining.json';

describe('Python display preserves teaching source', () => {
  it('preserves every character and line in course scripts', () => {
    const scripts = [...traces.map(s => s.code), ...chaining.chains.map(s => s.code), ...chaining.reraises.map(s => s.code)];
    for (const code of scripts) expect(pythonLines(code).map(line => line.map(p => p.text).join('')).join('\n')).toBe(code);
  });
  it('keeps strings and comments separate from important names and leaves shell commands plain', () => {
    const code = '# original\ndef parse(value):\n    error = """original\nvalue <tag>"""\n    return parse(value)';
    const lines = pythonLines(code);
    expect(lines[0].every(p => p.kind === 'comment')).toBe(true);
    expect(lines[3].filter(p => p.text.includes('value')).every(p => p.kind === 'triple-quoted-string')).toBe(true);
    expect(lines[4].find(p => p.text === 'parse')?.kind).toBe('function');
    expect(lines[4].find(p => p.text === 'value')?.kind).toBe('landmark');
    expect(pythonLines('$env:COURSE_IMPL = "exercises"', false)[0].every(p => !p.kind)).toBe(true);
  });
});
