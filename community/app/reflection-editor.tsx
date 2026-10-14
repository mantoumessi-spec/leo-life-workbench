'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Maximize2,Minimize2} from 'lucide-react';

export default function ReflectionEditor({day,value,disabled,onChange,syncLabel,onRetry}:{day:string;value:string;disabled:boolean;onChange:(value:string)=>void;syncLabel:string;onRetry:()=>void}) {
 const [expanded,setExpanded]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLTextAreaElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!expanded)return;
  const previous=document.body.style.overflow;
  dialog.current?.showModal();document.body.style.overflow='hidden';
  input.current?.focus();input.current?.setSelectionRange(value.length,value.length);
  return ()=>{document.body.style.overflow=previous;trigger.current?.focus();};
 },[expanded]);
 const field=(full=false)=><textarea ref={full?input:undefined} aria-label={`${day} ${full?'沉浸式小结':'当天小结'}`} disabled={disabled} maxLength={2000} value={value} onChange={e=>onChange(e.target.value)} placeholder="做了什么、有什么感受，随便写几句就好。"/>;
 return <>
  <div className="reflection-tools"><span>小结 · 可拖动右下角调整高度</span><button ref={trigger} type="button" className="text-button" onClick={()=>setExpanded(true)} aria-label={`${day} 全屏写作`}><Maximize2 size={14}/>全屏写作</button></div>
  <div className="reflection-field">{field()}</div>
  {expanded&&createPortal(<dialog ref={dialog} className="reflection-immersive" aria-labelledby={`writing-${day}`} onCancel={e=>{e.preventDefault();setExpanded(false);}}>
   <header><div><span className="writing-date">{day}</span><h2 id={`writing-${day}`}>给今天留一点文字</h2></div><button type="button" className="button secondary" onClick={()=>setExpanded(false)}><Minimize2 size={16}/>收起</button></header>
   <div className="writing-paper">{field(true)}</div>
   <footer><span role="status">{syncLabel}</span><button type="button" className="text-button" onClick={onRetry}>重试同步</button><span>{value.length} / 2000 字<span className="writing-escape"> · Esc 收起</span></span></footer>
  </dialog>,document.body)}
 </>;
}
