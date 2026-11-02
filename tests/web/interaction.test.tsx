import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import Quiz from '../../src/Quiz';
import TracePlayer from '../../src/TracePlayer';
import rawTraces from '../../src/data/traces.json';
import type { Scenario } from '../../src/content/schema';
const traces = rawTraces as Scenario[];
import { chapters } from '../../src/content/chapters';
describe('Python trace replay', () => {
  it.each(traces.map(s=>[s.id,s] as const))('replays every state in %s exactly', (_id,scenario) => {
    render(<TracePlayer scenarios={[scenario]} reduced={true}/>);
    const slider=screen.getByRole('slider');
    for(let i=0;i<scenario.steps.length;i++) {
      fireEvent.change(slider,{target:{value:i}});
      const step=scenario.steps[i];
      expect(screen.getByLabelText('累计标准输出').textContent).toBe(step.output.join('\n') || '（尚无输出）');
      expect(document.querySelector('.event-card')?.textContent).toContain(step.explanation);
      expect(Array.from(document.querySelectorAll('.stack li')).map(e=>e.textContent)).toEqual(step.stack);
      for(const [key,value] of Object.entries(step.state)) {
        expect(Array.from(document.querySelectorAll('.runtime-state dl>div')).some(el=>el.querySelector('dt')?.textContent===key && el.querySelector('dd')?.textContent===value)).toBe(true);
      }
    }
  });
  it('renders every recorded event state and output without inventing results', () => {
    const scenarios = traces.filter(s => s.chapter === '01');
    render(<TracePlayer scenarios={scenarios} reduced={false}/>);
    const next = screen.getByRole('button',{name:'下一步'});
    for(const step of scenarios[0].steps) {
      fireEvent.click(next);
      expect(screen.getByLabelText('累计标准输出').textContent).toBe(step.output.join('\n') || '（尚无输出）');
      if(step.line > 0) expect(document.querySelector('[aria-current="step"] .line-number')?.textContent).toBe(String(step.line));
      const state = document.querySelector('.runtime-state')!;
      for(const value of Object.values(step.state)) expect(state.textContent).toContain(value);
    }
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'重置实验'}));
    expect(next).not.toBeDisabled();
    expect(screen.getByLabelText('累计标准输出')).toHaveTextContent('（尚无输出）');
  });
  it('plays, pauses, stops at the end and supports reduced motion', () => {
    vi.useFakeTimers();
    const {rerender} = render(<TracePlayer scenarios={[traces[0]]} reduced={false}/>);
    fireEvent.click(screen.getByRole('button',{name:'播放'}));
    act(() => { vi.advanceTimersByTime(900); });
    expect(screen.getByRole('slider')).toHaveValue('0');
    fireEvent.click(screen.getByRole('button',{name:'暂停'}));
    act(() => { vi.advanceTimersByTime(2000); });
    expect(screen.getByRole('slider')).toHaveValue('0');
    fireEvent.click(screen.getByRole('button',{name:'播放'}));
    act(() => { vi.advanceTimersByTime(traces[0].steps.length * 900); });
    expect(screen.getByRole('button',{name:'重播'})).toBeEnabled();
    rerender(<TracePlayer scenarios={[traces[0]]} reduced={true}/>);
    expect(screen.getByRole('button',{name:'重播'})).toBeDisabled();
    vi.useRealTimers();
  });
  it('resets output when switching scenario and exposes the full static trace', () => {
    const data = traces.filter(s=>s.chapter==='02'); if(data.length < 2) throw new Error('Need two verified scenarios');
    render(<TracePlayer scenarios={data} reduced={false}/>);
    fireEvent.change(screen.getByRole('slider'),{target:{value:data[0].steps.length-1}});
    fireEvent.change(screen.getByRole('combobox'),{target:{value:data[1].id}});
    expect(screen.getByRole('slider')).toHaveValue('-1');
    expect(document.querySelectorAll('.static-trace>li')).toHaveLength(data[1].steps.length);
  });
});
describe('honest practice feedback', () => {
  it('does not count repeated clicks as attempts; records hint use', () => {
    const quiz = chapters[0].quizzes[0]; const answer = vi.fn();
    render(<Quiz quiz={quiz} onAnswer={answer}/>);
    expect(screen.getByRole('button',{name:'检查答案'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:/提示 1/}));
    fireEvent.click(screen.getAllByRole('radio')[quiz.answer]);
    fireEvent.click(screen.getByRole('button',{name:'检查答案'}));
    expect(answer).toHaveBeenCalledWith(true,true);
    fireEvent.click(screen.getByRole('button',{name:'检查答案'}));
    expect(answer).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(quiz.explanation);
    fireEvent.click(screen.getByRole('button',{name:'重新作答'}));
    expect(screen.getByRole('button',{name:'检查答案'})).toBeDisabled();
  });
});
