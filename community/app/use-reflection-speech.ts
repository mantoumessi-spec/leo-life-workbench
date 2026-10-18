'use client';
import {useEffect,useRef,useState} from 'react';
import {appendSpeech,browserSpeech,speechCollector,speechError,type SpeechRecognizer} from '../lib/speech-input';
export function useReflectionSpeech(day:string,value:string,onChange:(value:string)=>void,disabled:boolean,limit=20000){
 const [supported,setSupported]=useState(false),[active,setActive]=useState(false),[stopping,setStopping]=useState(false);
 const [interim,setInterim]=useState(''),[message,setMessage]=useState(''),[overflow,setOverflow]=useState('');
 const recognition=useRef<SpeechRecognizer|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const latest=useRef({value,onChange,disabled});latest.current={value,onChange,disabled};
 function dispose(){const r=recognition.current;recognition.current=null;if(timer.current)clearTimeout(timer.current);if(r){r.onresult=null;r.onend=null;r.onerror=null;r.abort();}}
 useEffect(()=>{setSupported(Boolean(browserSpeech()));return dispose;},[]);
 useEffect(()=>{dispose();setActive(false);setStopping(false);setInterim('');setOverflow('');setMessage('');},[day]);
 function stop(){
  if(!recognition.current)return;
  setStopping(true);setMessage('正在完成最后一句识别…');
  try{recognition.current.stop();}catch{dispose();setActive(false);setStopping(false);setInterim('');}
  if(timer.current)clearTimeout(timer.current);
  timer.current=setTimeout(()=>{if(!recognition.current)return;dispose();setActive(false);setStopping(false);setInterim('');setMessage('识别已停止。已转成的文字已保留；请检查最后一句。');},5000);
 }
 useEffect(()=>{if(disabled&&recognition.current)stop();},[disabled]);
 function start(){
  if(recognition.current||latest.current.disabled||overflow)return;
  const Constructor=browserSpeech();if(!Constructor)return;
  if(latest.current.value.length>=limit){setMessage(`已到 ${limit} 字上限，请先整理文字再继续口述。`);return;}
  const r=new Constructor(),collect=speechCollector();recognition.current=r;
  r.lang='zh-CN';r.continuous=true;r.interimResults=true;
  setMessage('正在聆听，说完后点“停止口述”。');setActive(true);setStopping(false);
  r.onresult=event=>{
   if(recognition.current!==r)return;
   const result=collect(event.results);setInterim(result.interim);
   if(result.final){
    const next=appendSpeech(latest.current.value,result.final,limit);
    latest.current.value=next.value;latest.current.onChange(next.value);
    if(next.remainder){setOverflow(old=>old+next.remainder);stop();setMessage(`已到 ${limit} 字上限，多出的文字保留在下面，请复制留存。`);}
   }
  };
  r.onerror=event=>{if(recognition.current!==r)return;setMessage(speechError(event.error));};
  r.onend=()=>{if(recognition.current!==r)return;recognition.current=null;if(timer.current)clearTimeout(timer.current);setActive(false);setStopping(false);setInterim('');setMessage(old=>old.startsWith('正在')?'本次口述已结束，文字可以继续修改。':old);};
  try{r.start();}catch{dispose();setActive(false);setMessage('无法启动语音输入，请重试或使用键盘语音输入。');}
 }
 return {supported,active,stopping,interim,message,overflow,start,stop,clearOverflow:()=>setOverflow('')};
}
