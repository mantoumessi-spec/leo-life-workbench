'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowRight,Check,Leaf,Mic} from 'lucide-react';
import {checkInLabels,projectUpdateSchema,weekStart,type Log,type Project,type ProjectUpdate,type Workspace} from '../lib/workspace';
import {getPlan,putPlan} from '../lib/planning';
import {applyProjectUpdate,editProjectEntry,projectAttention,projectHistory} from '../lib/project-progress';
import {PlannerDialog} from './planning-controls';
import {weekFacts} from '../lib/weekly-review';
type Props={data:Workspace;today:string;scope:string;syncLabel:string;showPrompt:boolean;projectId:string;entryId:string;onEdit:(id:string,entryId?:string)=>void;onVoice:()=>void;onProjects:()=>void;save:(s:Workspace,message?:string)=>Promise<boolean>};
export default function ProjectProgress({data,today,scope,syncLabel,showPrompt,projectId,entryId,onEdit,onVoice,onProjects,save}:Props){
 const attention=projectAttention(data,today),plan=getPlan(data,weekStart(today)),details=useRef<HTMLDetailsElement>(null);
 const [error,setError]=useState('');
 useEffect(()=>{if(!attention.pending.length&&details.current)details.current.open=false;},[attention.pending.length]);
 async function focus(id:Project['id'],checked:boolean){const ids=checked?[...attention.focus,id]:attention.focus.filter(x=>x!==id);if(ids.length>3){setError('先选最重要的三项就好，其他项目仍会保留。');return;}setError('');await save(putPlan(data,{...plan,focusProjectIds:ids}),'');}
 async function acknowledge(p:Project,kind:'not_planned'|'later'){
  try{await save(applyProjectUpdate(data,{projectId:p.id,kind,text:kind==='not_planned'?'今天不安排，按原节奏推进。':'今天稍后再看，不重复提示。'},today,crypto.randomUUID(),new Date().toISOString()),'已记下，今天不再重复问。');}catch(e){setError((e as Error).message);}
 }
 const selected=data.projects.find(p=>p.id===projectId);
 return <>{showPrompt&&<details className="project-nudge" ref={details}>
  <summary><span><Leaf size={17}/>接着往前走</span><small>{attention.pending.length?`${attention.pending.length} 项等你看看`:attention.recorded.length?'今天的记录，已经记得了':'给重要的事留一点位置'}</small></summary>
  <div className="nudge-body"><p className="help-text">先看看已有记录。没有记录，只代表还不知道，不代表没有行动。</p>
  {error&&<p className="error-banner" role="alert">{error}</p>}
  {attention.pending.slice(0,3).map(({project:p,reason,adjustments})=><article className="nudge-item" key={p.id}><div className="nudge-item-head"><strong>{p.name}</strong><small>{reason}</small></div><p>{p.next||'下一步还没想清楚，也可以先聊聊卡在哪里。'}</p>{adjustments>=2&&<p className="nudge-gentle">已经有两次调整记录。要不要看看，是时间不够，还是下一步还不够清楚？</p>}<div className="nudge-actions"><button className="text-button" onClick={()=>onEdit(p.id)}>有进展 / 遇到卡点 <ArrowRight size={13}/></button><button className="text-button" onClick={()=>void acknowledge(p,'not_planned')}>今天不安排</button><button className="text-button" onClick={()=>void acknowledge(p,'later')}>稍后再看</button></div></article>)}
  {!attention.pending.length&&<p className="nudge-empty">{attention.focus.length?'今天没有需要再追问的项目。照自己的节奏来。':'可以先选一个本周想推进的项目，不必六项同时加速。'}</p>}
  {attention.pending.length>3&&<button className="text-button" onClick={onProjects}>还有 {attention.pending.length-3} 项，去项目页看看</button>}
  {attention.recorded.length>0&&<details className="nudge-recorded"><summary><Check size={14}/>今天已有记录 · {attention.recorded.length} 项</summary>{attention.recorded.map(({project:p,record})=><div key={p.id}><strong>{p.name}<small>{record!.label}</small></strong><p>{record!.text}</p><button className="text-button" onClick={()=>onEdit(p.id)}>记一笔新进展</button>{record?.log&&<button className="text-button" onClick={()=>onEdit(p.id,record.log!.id)}>修改这条记录</button>}</div>)}</details>}
  <details className="nudge-focus"><summary>本周想推进哪些项目 <small>选 1—3 项，也可以暂不选</small></summary>{data.projects.map(p=><div className="nudge-focus-row" key={p.id}><label className="checkbox-label"><input type="checkbox" checked={attention.focus.includes(p.id)} disabled={!attention.focus.includes(p.id)&&attention.focus.length>=3} onChange={e=>void focus(p.id,e.target.checked)}/>{p.name}</label>{attention.focus.includes(p.id)&&<label className="nudge-outcome">这周希望走到哪一步<input aria-label={`${p.name} 本周希望走到哪一步`} maxLength={2000} value={plan.outcomes.find(o=>o.projectId===p.id)?.deliverable||''} placeholder="一个具体的结果，想清楚后再填" onChange={e=>void save(putPlan(data,{...plan,outcomes:plan.outcomes.map(o=>o.projectId===p.id?{...o,deliverable:e.target.value,done:false}:o)}),'')}/></label>}</div>)}<p className="help-text">只决定关注顺序，不暂停其他项目。已有交付和到期跟进仍会提示。</p></details>
  <div className="nudge-footer"><button className="text-button" onClick={onVoice}><Mic size={14}/>累了，就口述给 AI</button><small>打开工作台时提示，不发送站外通知</small></div></div>
 </details>}
 {selected&&<PlannerDialog title={`${selected.name} · ${entryId?'修改记录':'记一笔新进展'}`} busy={false} onClose={()=>onEdit('')}><ProjectCheckIn key={`${selected.id}:${entryId||'new'}:${today}`} entryId={entryId} project={selected} data={data} day={today} scope={scope} syncLabel={syncLabel} save={save} onClose={()=>onEdit('')} onVoice={onVoice}/></PlannerDialog>}
 </>;
}
function ProjectCheckIn({project,data,day,entryId,scope,syncLabel,save,onClose,onVoice}:{project:Project;entryId:string;data:Workspace;day:string;scope:string;syncLabel:string;save:Props['save'];onClose:()=>void;onVoice:()=>void}){
 const previous=entryId?projectHistory(data,project.id).find(l=>l.id===entryId):undefined;
 const entryDay=previous?.day||day;
 const [value,setValue]=useState<ProjectUpdate>({projectId:project.id,kind:previous?.checkIn?.kind||'progress',text:previous?.text||'',...(previous?.checkIn?.next!==undefined?{next:previous.checkIn.next}:{}),...(previous?.checkIn?.attentionDay!==undefined?{attentionDay:previous.checkIn.attentionDay}:{})});
 const eventId=useRef(previous?.id||crypto.randomUUID()),key=`leo-project-input:${encodeURIComponent(scope)}:${project.id}:${day}${entryId?':edit:'+entryId:''}`;
 const [error,setError]=useState(''),[recovery,setRecovery]=useState<{value:ProjectUpdate;id:string}|null>(null);
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem(key)||'null');if(v&&typeof v.value?.text==='string'&&JSON.stringify(v.value)!==JSON.stringify(value))setRecovery(v);}catch{setError('本机输入暂时无法读取，请保留页面。');}},[]);
 function change(next:ProjectUpdate){setValue(next);try{localStorage.setItem(key,JSON.stringify({value:next,id:eventId.current}));}catch{setError('本机草稿暂存失败，请保持页面打开。');}
  const parsed=projectUpdateSchema.safeParse(next);if(!previous&&!parsed.success){setError('先留在本机；补充一句进展或原因后自动保存。');return;}
  try{if(entryId&&!previous)throw new Error('找不到原记录，请关闭后重新打开。');const candidate=previous?editProjectEntry(data,project.id,previous.id,next.text,next.kind):applyProjectUpdate(data,next,day,eventId.current,new Date().toISOString());void save(candidate,'').then(ok=>{if(ok){setError('');localStorage.removeItem(key);}else setError('暂未保存，请查看页面同步提示。');});}catch(e){setError((e as Error).message);}
 }
 return <div className="project-checkin"><p className="modal-description">{entryDay} · {previous?'修改这条记录，保留原日期与顺序。':'新的一笔，接在已有记录之后。'}</p><p className="draft-message" role="status">{syncLabel}</p>
 {recovery&&<div className="draft-notice"><p>这里还有一段本机输入。</p><button className="text-button" onClick={()=>{eventId.current=recovery.id;change(recovery.value);setRecovery(null);}}>恢复输入</button><button className="text-button" onClick={()=>{localStorage.removeItem(key);setRecovery(null);}}>保留当前记录</button></div>}
 <fieldset className="task-fieldset" disabled={!!recovery}>{(!previous||previous.checkIn)&&<label>{previous?'当时的情况':'今天的情况'}<select value={value.kind} onChange={e=>change({...value,kind:e.target.value as ProjectUpdate['kind']})}>{Object.entries(checkInLabels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label>}
 <label>{value.kind==='progress'?'走到了哪里':value.kind==='blocked'?'卡在哪里':'留一句说明'}<textarea autoFocus rows={3} maxLength={previous?20000:2000} value={value.text} placeholder={value.kind==='blocked'?'时间被占满、还没想清步骤、需要别人配合……':'做成了什么、得到什么反馈，或者今天决定先放一放。'} onChange={e=>change({...value,text:e.target.value})}/></label>
 {value.kind==='blocked'&&<p className="help-text">先找卡点，再决定是缩小动作、换个时间，还是重新考虑方向。</p>}
 {!previous&&<details className="task-details"><summary>留一个下一步，或约个再看的时间</summary><label>下一步<input value={value.next??project.next} maxLength={1000} onChange={e=>change({...value,next:e.target.value})} placeholder="不用今天想清所有事情"/></label><label>下次关注日期（可留空）<input type="date" value={value.attentionDay??project.attentionDay??''} onInput={e=>change({...value,attentionDay:e.currentTarget.value})}/></label><p className="help-text">这是下次再看的日期，不是新的截止期限；不会自动新增待办或发通知。</p></details>}{previous&&<p className="help-text">这里只修改这条记录的内容，不会改变项目当前的下一步与关注日期。</p>}
 {error&&<p className="error-banner" role="alert">{error}</p>}<div className="modal-actions"><button className="text-button" onClick={()=>{onClose();onVoice();}}>改用口述</button><button className="button primary" onClick={onClose}>写好了</button></div><p className="help-text">填写后自动保存；同一条进展同步用于项目卡和回顾。</p></fieldset></div>;
}
export function ProjectProgressInfo({data,project,onEdit}:{data:Workspace;project:Project;onEdit:(id:string)=>void}){
 const history=projectHistory(data,project.id),[expanded,setExpanded]=useState(false);
 const actual=data.plans.flatMap(p=>weekFacts(data,p.week)).filter(f=>f.kind==='actual'&&f.projectId===project.id&&!f.logId);
 const timeline=[...history.filter(l=>l.text.trim()).map(l=>({id:l.id,day:l.day,log:l,fact:null})),...actual.map(f=>({id:f.id,day:f.day,log:null,fact:f}))].sort((a,b)=>b.day.localeCompare(a.day));
 const visible=expanded?timeline:timeline.slice(0,3);
 return <section className="project-progress-info" aria-label={`${project.name}的进展时间线`}>
  <div className="progress-timeline-heading"><h4>一路走来的记录</h4><small>{timeline.length?`${timeline.length} 条`:'从第一笔开始'}</small></div>
  {timeline.length?<ol className="progress-timeline">{visible.map(item=>item.log?<ProjectTimelineEntry key={item.id} entry={item.log} onEdit={()=>onEdit(item.id)}/>:<li className="progress-timeline-entry" key={item.id}><div className="progress-entry-meta"><time>{item.day}</time><span>实际记录</span></div><p>{item.fact!.text}</p><small>{item.fact!.time||'用时未记录'} · {item.fact!.sources.join('、')}（在原记录中修改）</small></li>)}</ol>:<p className="progress-empty">做成了什么、卡在哪里，都可以留在这里。</p>}
  {timeline.length>3&&<button className="text-button progress-expand" aria-expanded={expanded} onClick={()=>setExpanded(!expanded)}>{expanded?'收起较早记录':`查看全部 ${timeline.length} 条记录`}</button>}
 </section>;
}
function ProjectTimelineEntry({entry:l,onEdit}:{entry:Log;onEdit:()=>void}){
 const recordedTime=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(l.createdAt));
 return <li className="progress-timeline-entry">
  <div className="progress-entry-meta"><time dateTime={l.day}>{l.day}</time><span className={`progress-entry-kind kind-${l.checkIn?.kind||'note'}`}>{l.checkIn?checkInLabels[l.checkIn.kind]:'记录'}</span></div>
  {l.text.length>180?<details className="progress-long-text"><summary>{l.text.slice(0,120)}… <span>展开全文</span></summary><p>{l.text}</p></details>:<p>{l.text}</p>}
  {(l.evidence||l.checkIn?.next!==undefined||l.checkIn?.attentionDay!==undefined)&&<details className="progress-entry-context"><summary>当时的下一步 / 补充信息</summary>{l.checkIn?.next!==undefined&&<p>下一步：{l.checkIn.next||'暂未安排'}</p>}{l.checkIn?.attentionDay!==undefined&&<p>约定关注：{l.checkIn.attentionDay||'未设置'}</p>}{l.evidence&&<p>证据：{l.evidence}</p>}</details>}
  <div className="progress-entry-footer"><small title={`录入时间：${new Date(l.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}`}>录入于 {recordedTime}</small><button className="text-button" aria-label={`修改 ${l.day} 的记录：${l.text.slice(0,30)}`} onClick={onEdit}>修改</button></div>
 </li>;
}
