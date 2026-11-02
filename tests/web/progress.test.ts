import { describe, it, expect } from 'vitest';
import { chapters } from '../../src/content/chapters';
import { emptyProgress, parseProgress, recordAnswer, chapterStatus } from '../../src/progress';
describe('versioned progress', () => {
  it('round trips separate chapters and records', () => {
    const p = recordAnswer(emptyProgress(), chapters[0].quizzes[0].id, true, false);
    p.chapters['01'] = { read:true,practice:false };
    expect(parseProgress(JSON.stringify(p),chapters)).toEqual(p);
    expect(chapterStatus(chapters[0],p)).not.toBe('完成自测');
  });
  it('rejects incompatible versions and invalid counters', () => {
    expect(() => parseProgress('{"schema":99}',chapters)).toThrow();
    const p = emptyProgress(); p.answers[chapters[0].quizzes[0].id] = { attempts:1,correctAttempts:3,lastCorrect:true,cleanStreak:3,usedHint:false };
    expect(() => parseProgress(JSON.stringify(p),chapters)).toThrow();
    expect(() => parseProgress('invalid',chapters)).toThrow();
  });
  it('requires independent recovery after an error and preserves other chapters', () => {
    let p = emptyProgress();
    const c = chapters[0]; p.chapters[c.id] = {read:true,practice:true};
    for(const q of c.quizzes) p = recordAnswer(p,q.id,true,false);
    expect(chapterStatus(c,p)).toBe('完成自测');
    p = recordAnswer(p,c.quizzes[0].id,false,false);
    expect(chapterStatus(c,p)).toBe('待复习');
    p = recordAnswer(p,c.quizzes[0].id,true,false);
    expect(chapterStatus(c,p)).toBe('待复习');
    p = recordAnswer(p,c.quizzes[0].id,true,false);
    expect(chapterStatus(c,p)).toBe('完成自测');
    p = recordAnswer(p,c.quizzes[0].id,true,true);
    expect(chapterStatus(c,p)).toBe('待复习');
    if(chapters[1]) expect(chapterStatus(chapters[1],p)).toBe('未开始');
  });
});
