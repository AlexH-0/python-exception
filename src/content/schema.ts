export interface Quiz {
  id: string; kind: 'predict' | 'analyze' | 'quiz';
  question: string; code?: string; options: string[]; answer: number;
  explanation: string; hints: string[]; knowledge: string;
}
export interface Section { id: string; title: string; paragraphs: string[]; code?: string; exampleId?: string; bullets?: string[] }
export interface Chapter {
  id: string; title: string; subtitle: string; minutes: number; level: '基础' | '进阶' | '综合';
  prerequisites: string[]; outcomes: string[]; hook: string; sections: Section[];
  scenarioIds: string[]; quizzes: Quiz[]; misconceptions: { myth: string; correction: string }[];
  practice: { title: string; task: string; file: string; test: string; hints: string[]; solution: string; checklist: string[] };
  project: string; recap: string[]; sources: { title: string; url: string }[];
}
export interface TraceStep {
  line: number; event: string; explanation: string; output: string[];
  stack: string[]; state: Record<string,string>;
}
export interface Scenario {
  id: string; chapter: string; title: string; question: string; prediction: string;
  code: string; steps: TraceStep[]; output: string[]; exception: string | null;
  notes: string; pythonVersion: string;
}
