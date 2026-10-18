'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Maximize2,Minimize2,Mic,Square} from 'lucide-react';
import {DESKTOP} from '../lib/community-features';
import {useReflectionSpeech} from './use-reflection-speech';

export default function ReflectionEditor({day,value,disabled,onChange,syncLabel,onRetry,title="给今天留一点文字",limit=20000,placeholder="做了什么、有什么感受，随便写几句就好。"}:{title?:string;limit?:number;placeholder?:string;day:string;value:string;disabled:boolean;onChange:(value:string)=>void;syncLabel:string;onRetry:()=>void}) {
 const [expanded,setExpanded]=useState(false);
 const speech=useReflectionSpeech(day,value,onChange,disabled,limit);
 const close=()=>{if(speech.active){speech.stop();return;}setExpanded(false);};
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLTextAreaElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!expanded)return;
  const previous=document.body.style.overflow;
  dialog.current?.showModal();document.body.style.overflow='hidden';
  input.current?.focus();input.current?.setSelectionRange(value.length,value.length);
  return ()=>{document.body.style.overflow=previous;trigger.current?.focus();};
 },[expanded]);
 const field=(full=false)=><textarea ref={full?input:undefined} aria-label={`${day} ${full?'沉浸式小结':'当天小结'}`} disabled={disabled} maxLength={limit} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>;
 return <>
  <div className="reflection-tools"><span>直接填写，自动保存</span><button ref={trigger} type="button" className="text-button" onClick={()=>setExpanded(true)} aria-label={`${day} 全屏写作`}><Maximize2 size={14}/>全屏写作</button></div>
  <div className="reflection-field">{field()}</div>
  {expanded&&createPortal(<dialog ref={dialog} className="reflection-immersive" aria-labelledby={`writing-${day}`} onCancel={e=>{e.preventDefault();close();}}>
   <header><div><span className="writing-date">{day}</span><h2 id={`writing-${day}`}>{title}</h2></div><button type="button" className="button secondary" onClick={close}><Minimize2 size={16}/>收起</button></header>
   {DESKTOP?<section className="writing-voice"><p>可使用系统听写输入文字。桌面试用版不启用浏览器语音识别、不保存录音。</p></section>:<section className="writing-voice" aria-label="语音输入">
    <div className="writing-voice-controls"><button type="button" className={`button ${speech.active?'voice-active':'secondary'}`} disabled={speech.stopping||(!speech.active&&(disabled||!speech.supported||Boolean(speech.overflow)))} onClick={speech.active?speech.stop:speech.start}>{speech.active?<Square size={15}/>:<Mic size={16}/>} {speech.stopping?'正在停止…':speech.active?'停止口述':'开始口述'}</button><span>{speech.supported?'浏览器识别（桌面版请使用系统听写）':'当前浏览器不支持直接口述，可点输入框后用键盘的麦克风。'}</span></div>
    {speech.supported&&<p className="voice-privacy">点击开始后将请求麦克风权限。浏览器可能将音频发送给其语音服务商处理；工作台只保存文字，不保存录音，不接付费 AI 接口。</p>}
    {speech.message&&<p role="status">{speech.message}{speech.active?' 收起前请先停止口述。':''}</p>}
    {speech.interim&&<p className="voice-interim">正在识别（尚未保存）：{speech.interim}</p>}
    {speech.overflow&&<label className="voice-overflow">以下超出字数的文字尚未保存，请复制留存<textarea readOnly value={speech.overflow} aria-label="超出字数的口述文字"/><button type="button" className="text-button" onClick={speech.clearOverflow}>已另存，清除余文</button></label>}
   </section>}
   <div className="writing-paper">{field(true)}</div>
   <footer><span role="status">{syncLabel}</span><button type="button" className="text-button" onClick={onRetry}>重试同步</button><span>{value.length} / {limit} 字<span className="writing-escape"> · Esc 收起</span></span></footer>
  </dialog>,document.body)}
 </>;
}
