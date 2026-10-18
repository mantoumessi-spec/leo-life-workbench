
'use client';
import LocalNote from './local-note';
import {weekFacts} from '../lib/weekly-review';
import {weekStart,type Workspace} from '../lib/workspace';
type Props={data:Workspace;day:string;scope:string;syncLabel:string;save:(s:Workspace,message?:string)=>Promise<boolean>;onRetry:()=>void;onVoice:(day?:string,text?:string,sourceId?:string)=>void};
export default function QuickCapture({data,day}:Props){
 const records=weekFacts(data,weekStart(day)).filter(f=>f.day===day&&f.kind==='actual');
 return <section className="quick-capture"><LocalNote key={day} kind="daily" day={day}/>{!!records.length&&<details className="panel capture-records"><summary>工作台已有的行动与进展 · {records.length}</summary>{records.map(f=><article key={f.id}><small>{f.time||'用时未记录'} · {f.sources.join('、')}{f.projectId?' · '+(data.projects.find(p=>p.id===f.projectId)?.name||'生活与精力'):''}</small><p style={{whiteSpace:'pre-wrap'}}>{f.text}</p></article>)}</details>}</section>;
}
