import { useEffect, useRef, useState } from 'react';
import { chapters } from './content/chapters';
import { chapterStatus, type Progress } from './progress';

export default function CourseNavigation({route,progress,onNavigate}:{route:string;progress:Progress;onNavigate:(id:string)=>void}) {
  const [open,setOpen]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  const panel=useRef<HTMLElement>(null);
  const closeTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const completed=chapters.filter(c=>chapterStatus(c,progress)==='完成自测').length;
  const cancelClose=()=>{clearTimeout(closeTimer.current);closeTimer.current=undefined;};
  const close=(restoreFocus=false)=>{cancelClose();setOpen(false);if(restoreFocus)trigger.current?.focus({preventScroll:true});};
  useEffect(()=>{setOpen(false);},[route]);
  useEffect(()=>()=>clearTimeout(closeTimer.current),[]);
  useEffect(()=>{
    if(!open)return;
    const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key!=='Escape')return;event.preventDefault();setOpen(false);if(panel.current?.contains(document.activeElement))trigger.current?.focus({preventScroll:true});};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  const hoverOpen=(pointerType:string)=>{
    if(pointerType!=='mouse'||!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return;
    cancelClose();setOpen(true);
  };
  const hoverLeave=(pointerType:string)=>{
    if(pointerType!=='mouse')return;
    cancelClose();closeTimer.current=setTimeout(()=>{if(!panel.current?.contains(document.activeElement))setOpen(false);},220);
  };
  const navigate=(id:string)=>{close();onNavigate(id);};
  return <div className="course-navigation" onPointerEnter={e=>hoverOpen(e.pointerType)} onPointerLeave={e=>hoverLeave(e.pointerType)} onFocusCapture={cancelClose}>
    <div className="course-edge-zone" aria-hidden="true"/>
    <button ref={trigger} className={'course-rail-trigger'+(open?' rail-open':'')} aria-label={`目录${completed}/${chapters.length}，已完成自测`} aria-expanded={open} aria-controls="course-drawer" onClick={event=>{
      if(open){close();return;}
      setOpen(true);
      if(event.detail===0)requestAnimationFrame(()=>{const active=panel.current?.querySelector<HTMLElement>('[aria-current="page"]')??panel.current?.querySelector<HTMLElement>('a');active?.focus();});
    }}>
      <span className="course-rail-label" aria-hidden="true">目录</span>
      <span className="course-rail-track" aria-hidden="true">{chapters.map(c=><span key={c.id} className={(chapterStatus(c,progress)==='完成自测'?'rail-complete ':'')+(route===c.id?'rail-current':'')}/>)}</span>
      <span className="course-rail-count" aria-hidden="true">{completed}<span>/{chapters.length}</span></span>
    </button>
    <aside ref={panel} id="course-drawer" className="sidebar course-drawer" hidden={!open} inert={!open} aria-label="课程目录" onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node)&&!trigger.current?.contains(event.relatedTarget as Node))close();}}>
      <div className="course-drawer-heading"><span>学习目录</span><button aria-label="收起课程目录" onClick={()=>close(true)}>×</button></div>
      <a className={'overview-link '+(route==='home'?'current':'')} href="#/home" aria-current={route==='home'?'page':undefined} onClick={()=>navigate('home')}>课程总览 <span aria-hidden="true">↗</span></a>
      <div className="nav-caption">学习路线 <span>{chapters.length} 章</span></div>
      <nav aria-label="课程章节">{chapters.map(c=><a key={c.id} href={'#/'+c.id} onClick={()=>navigate(c.id)} className={'chapter-link '+(route===c.id?'current':'')} aria-current={route===c.id?'page':undefined}><span className="nav-number">{c.id}</span><span><span className="nav-title">{c.title}</span><small>{chapterStatus(c,progress)} · {c.minutes} 分钟</small></span>{chapterStatus(c,progress)==='完成自测'&&<span aria-label="完成自测">✓</span>}</a>)}</nav>
      <div className="sidebar-foot"><div><strong>{completed}</strong> / {chapters.length} 完成自测</div><progress aria-label="课程自测完成进度" max={chapters.length} value={completed}/><p>细条深色段表示完成自测，描边表示当前章。<br/>移出目录会收起，也可按 Esc。</p></div>
    </aside>
  </div>;
}
