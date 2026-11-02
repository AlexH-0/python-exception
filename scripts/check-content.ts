import { readFileSync,existsSync } from 'node:fs';
import { chapters } from '../src/content/chapters';
import traces from '../src/data/traces.json';
import rawExamples from '../src/data/examples.json';
const examples:Record<string,string> = rawExamples;
const errors:string[] = [];
const assert = (ok:unknown,msg:string) => {if(!ok) errors.push(msg);};
assert(chapters.length===12,'Expected 12 complete chapters');
const ids = new Set<string>(); const quizIds = new Set<string>();
for(const c of chapters) {
  assert(!ids.has(c.id),'Duplicate chapter '+c.id); ids.add(c.id);
  assert(c.outcomes.length>=2 && c.prerequisites.length>0,c.id+' missing objectives/prerequisites');
  assert(c.sections.length>=3 && c.sections.flatMap(s=>s.paragraphs).join('').length>=400,c.id+' insufficient explanation');
  assert(c.quizzes.length>=3 && c.quizzes.some(q=>q.kind==='quiz'),c.id+' missing assessment');
  assert(c.misconceptions.length>=2 && c.recap.length>=2,c.id+' missing misconception/recap');
  assert(c.practice.hints.length>=2 && c.practice.checklist.length>=2,c.id+' incomplete practice');
  assert(existsSync(c.practice.file),c.id+' missing practice file');
  assert(c.practice.test.includes('COURSE_IMPL') && c.practice.test.includes('exercises'),c.id+' practice must test learner code');
  assert(c.sources.every(s=>/^https:\/\/(docs.python.org\/3.11\/|peps.python.org\/|docs.pytest.org\/)/.test(s.url) || s.url==='https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/'),c.id+' non-authoritative/unversioned source');
  for(const s of c.sections) if(s.code || s.exampleId) {
    assert(!!s.exampleId,c.id+' code must have runnable exampleId');
    if(s.exampleId) {const path='python/examples/'+s.exampleId+'.py';assert(existsSync(path),path+' missing'); if(existsSync(path)) assert(readFileSync(path,'utf8').replace(/\r\n/g,'\n').trim()===(s.code ?? examples[s.exampleId])?.trim(),path+' differs from lesson code');}
  }
  for(const q of c.quizzes) {assert(!quizIds.has(q.id),'Duplicate quiz '+q.id);quizIds.add(q.id); assert(q.answer>=0&&q.answer<q.options.length,q.id+' bad answer index');assert(q.hints.length>=2&&q.explanation.length>30,q.id+' insufficient feedback');}
  assert(c.scenarioIds.length>0,c.id+' no scenario');for(const id of c.scenarioIds) assert(traces.some(s=>s.id===id),c.id+' unknown scenario '+id);
  assert(traces.some(t=>t.chapter===c.id),c.id+' no actual trace');
}
for(const t of traces) {assert(ids.has(t.chapter),t.id+' orphan trace');assert(t.steps.length>0&&t.pythonVersion.startsWith('3.11.'),t.id+' missing baseline');assert(t.steps.every(s=>s.line>=0&&s.line<=t.code.split('\n').length),t.id+' out-of-bounds line');}
assert(existsSync('public/python-course.zip'),'Missing downloadable Python package');
if(errors.length) {console.error(errors.join('\n'));process.exit(1);}
console.log('Verified '+chapters.length+' chapters, '+quizIds.size+' questions, '+traces.length+' Python traces, and exact runnable example parity.');
