import { chapters } from './content/chapters';
import type { Chapter } from './content/schema';

function neighbors(chapter:Chapter) {
  const index=chapters.findIndex(c=>c.id===chapter.id);
  return {previous:chapters[index-1],next:chapters[index+1]};
}

export function ChapterHeaderNavigation({chapter,visit}:{chapter:Chapter;visit:(id:string)=>void}) {
  const {previous,next}=neighbors(chapter);
  return <div className="chapter-heading-row">
    <div className="breadcrumb"><a href="#/home">学习路线</a><span>/</span><span>第 {chapter.id} 章</span><span className="badge">{chapter.level} · {chapter.minutes} 分钟</span></div>
    <nav className="chapter-neighbors" aria-label="相邻章节">
      <a href={previous?'#/'+previous.id:'#/home'} aria-label={previous?`上一章：第 ${previous.id} 章 ${previous.title}`:'返回学习路线'} title={previous?.title??'学习路线'} onClick={()=>{if(previous)visit(previous.id);}}><span aria-hidden="true">←</span>{previous?'上一章':'学习路线'}</a>
      <a href={next?'#/'+next.id:'#/home'} aria-label={next?`下一章：第 ${next.id} 章 ${next.title}`:'末章结束，返回学习路线'} title={next?.title??'学习路线'} onClick={()=>{if(next)visit(next.id);}}>{next?'下一章':'学习路线'}<span aria-hidden="true">→</span></a>
    </nav>
  </div>;
}

export function LessonFooter({chapter,screen,free,count,go,visit}:{chapter:Chapter;screen:number;free:boolean;count:number;go:(screen:number,free?:boolean)=>void;visit:(id:string)=>void}) {
  const {previous,next}=neighbors(chapter);
  return <nav className="sample-footer" aria-label="节间导航">
    {!free&&screen===0?<a className="button" href={previous?'#/'+previous.id:'#/home'} onClick={()=>{if(previous)visit(previous.id);}}>{previous?'← 上一章':'← 学习路线'}</a>:<button onClick={()=>free?go(screen):go(screen-1)}>{free?'返回本节':'← 上一节'}</button>}
    {!free&&screen<count-1?<button className="primary" onClick={()=>go(screen+1)}>下一节 →</button>:<a className="button primary" href={next?'#/'+next.id:'#/home'} onClick={()=>{if(next)visit(next.id);}}>{next?'下一章 →':'返回学习路线 →'}</a>}
  </nav>;
}
