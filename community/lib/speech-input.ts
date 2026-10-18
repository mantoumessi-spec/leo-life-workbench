// Browser speech only: no audio storage, API keys or server-side transcription.
export type SpeechResults = {length:number;[index:number]:{isFinal:boolean;0:{transcript:string}}};
export interface SpeechRecognizer {
 lang:string; continuous:boolean; interimResults:boolean;
 onresult:((event:{results:SpeechResults})=>void)|null;
 onerror:((event:{error:string})=>void)|null;
 onend:(()=>void)|null;
 start:()=>void; stop:()=>void; abort:()=>void;
}
export type SpeechConstructor = new()=>SpeechRecognizer;
export function browserSpeech():SpeechConstructor|undefined {
 if(typeof window==='undefined')return;
 const w=window as unknown as {SpeechRecognition?:SpeechConstructor;webkitSpeechRecognition?:SpeechConstructor};
 return w.SpeechRecognition||w.webkitSpeechRecognition;
}
// Final results are cumulative. Consume each index once, even when interim results change.
export function speechCollector(){
 const consumed=new Set<number>();
 return (results:SpeechResults)=>{
  let final='',interim='';
  for(let i=0;i<results.length;i++){
   const text=results[i][0].transcript;
   if(results[i].isFinal){if(!consumed.has(i)){consumed.add(i);final+=text;}}
   else interim+=text;
  }
  return {final,interim};
 };
}
export function appendSpeech(current:string,text:string,limit=2000){
 const separator=current&&!current.endsWith('\n')?'\n':'';
 const available=Math.max(0,limit-current.length-separator.length);
 // Don't split a Unicode surrogate pair at the text limit.
 let accepted='';for(const char of text){if(accepted.length+char.length>available)break;accepted+=char;}
 return {value:accepted?current+separator+accepted:current,remainder:text.slice(accepted.length)};
}
export function speechError(error:string){
 const messages:Record<string,string>={
  'not-allowed':'麦克风未获允许。请在浏览器中允许麦克风，或使用键盘语音输入。',
  'service-not-allowed':'当前浏览器不允许语音识别，请使用键盘语音输入。',
  'audio-capture':'没有找到可用的麦克风，请检查设备。',
  'network':'语音服务连接失败，请稍后重试，或使用键盘语音输入。',
  'no-speech':'暂时没有听到声音，可以重新开始口述。',
  'language-not-supported':'当前服务不支持中文识别，请使用键盘语音输入。',
 };
 return messages[error]||'语音识别已中断，已转成的文字会保留。可以重试或使用键盘语音输入。';
}
