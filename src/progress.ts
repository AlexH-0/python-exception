import type { Chapter } from './content/schema';
export const STORAGE_KEY = 'exception-lab:progress:v1';
export interface AnswerRecord { attempts: number; correctAttempts: number; lastCorrect: boolean; cleanStreak: number; usedHint: boolean }
export interface Progress {
  schema: 1; lastChapter: string;
  chapters: Record<string, { read: boolean; practice: boolean }>;
  answers: Record<string, AnswerRecord>;
  settings: { reducedMotion: boolean };
}
export function emptyProgress(): Progress { return { schema: 1, lastChapter: '01', chapters: {}, answers: {}, settings: { reducedMotion: false } }; }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 1000000;
export function parseProgress(raw: string, chapters: Chapter[]): Progress {
  if (raw.length > 1000000) throw new Error('进度文件超过 1 MB。');
  const data: unknown = JSON.parse(raw);
  if (!object(data) || data.schema !== 1) throw new Error('进度版本不兼容，支持 schema 1。');
  if (!object(data.chapters) || !object(data.answers) || !object(data.settings) || typeof data.settings.reducedMotion !== 'boolean') throw new Error('进度结构损坏。');
  const ids = new Set(chapters.map(c => c.id));
  const quizzes = new Set(chapters.flatMap(c => c.quizzes.map(q => q.id)));
  const result = emptyProgress();
  result.lastChapter = typeof data.lastChapter === 'string' && ids.has(data.lastChapter) ? data.lastChapter : chapters[0]?.id ?? '01';
  result.settings.reducedMotion = data.settings.reducedMotion;
  for (const [id, entry] of Object.entries(data.chapters)) {
    if (!ids.has(id)) continue;
    if (!object(entry) || typeof entry.read !== 'boolean' || typeof entry.practice !== 'boolean') throw new Error('章节记录损坏。');
    result.chapters[id] = { read: entry.read, practice: entry.practice };
  }
  for (const [id, entry] of Object.entries(data.answers)) {
    if (!quizzes.has(id)) continue;
    if (!object(entry) || !count(entry.attempts) || entry.attempts < 1 || !count(entry.correctAttempts) || !count(entry.cleanStreak) || typeof entry.lastCorrect !== 'boolean' || typeof entry.usedHint !== 'boolean' || entry.correctAttempts > entry.attempts || entry.cleanStreak > entry.correctAttempts || ((!entry.lastCorrect || entry.usedHint) && entry.cleanStreak !== 0) || (entry.lastCorrect && entry.correctAttempts === 0)) throw new Error('练习记录损坏。');
    result.answers[id] = { attempts: entry.attempts, correctAttempts: entry.correctAttempts, cleanStreak: entry.cleanStreak, lastCorrect: entry.lastCorrect, usedHint: entry.usedHint };
  }
  return result;
}
export function loadProgress(chapters: Chapter[]): { progress: Progress; warning: string } {
  try { const raw = localStorage.getItem(STORAGE_KEY); return { progress: raw ? parseProgress(raw, chapters) : emptyProgress(), warning: '' }; }
  catch { return { progress: emptyProgress(), warning: '无法读取本地进度（数据损坏、版本不兼容或存储被禁用）。本次可以继续学习；导出进度可另存备份。' }; }
}
export function recordAnswer(progress: Progress, id: string, correct: boolean, hint: boolean): Progress {
  const prev = progress.answers[id];
  return { ...progress, answers: { ...progress.answers, [id]: {
    attempts: (prev?.attempts ?? 0) + 1, correctAttempts: (prev?.correctAttempts ?? 0) + Number(correct),
    lastCorrect: correct, cleanStreak: correct && !hint ? (prev?.cleanStreak ?? 0) + 1 : 0, usedHint: hint,
  } } };
}
export function chapterStatus(chapter: Chapter, progress: Progress): string {
  const records = chapter.quizzes.map(q => progress.answers[q.id]);
  const attempted = records.some(Boolean);
  const settled = records.every(r => r && r.lastCorrect && r.cleanStreak >= (r.attempts > r.correctAttempts ? 2 : 1));
  const flags = progress.chapters[chapter.id];
  if (flags?.read && flags.practice && settled) return '完成自测';
  if (attempted && !settled) return '待复习';
  if (attempted || flags?.practice) return '练习中';
  return flags?.read ? '已阅读' : '未开始';
}
