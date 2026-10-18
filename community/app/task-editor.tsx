'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Star } from 'lucide-react';
import { taskSchema, taskDraftSchema, withSessions, importantTaskIds, dayKey, type Task, type Workspace, type Session } from '../lib/workspace';
import { mergeWorkspaceDraft } from '../lib/planning';

type Draft={task:Task;focus:boolean;base:Task};
export default function TaskEditor({initial,focus,data,scope,busy,onSave,onCancel,syncLabel,focusDay=dayKey()}:{focusDay?:string;initial:Task;focus:boolean;data:Workspace;scope:string;busy:boolean;syncLabel:string;onSave:(t:Task,focus:boolean,auto?:boolean,eventId?:string)=>Promise<boolean>;onCancel:()=>void}){
 const eventId=useRef(crypto.randomUUID()).current,lastQueued=useRef(initial);
 const [draft,setDraft]=useState<Draft>({task:initial,focus,base:initial});
 const [recovery,setRecovery]=useState<Draft|null>(null),[message,setMessage]=useState('');
 const isNew=!data.tasks.some(t=>t.id===initial.id);const key=useRef(`leo-task-draft-v4:${encodeURIComponent(scope)}:${isNew?'new':initial.id}`).current;
 useEffect(()=>{try{const raw=localStorage.getItem(key);if(raw){const v=JSON.parse(raw);setRecovery({task:taskDraftSchema.parse(v.task),base:taskDraftSchema.parse(v.base),focus:!!v.focus});}}catch{setMessage('暂时无法读取本机草稿，请保留当前页面。');}},[key]);
 function change(next:Draft){
  const current=data.tasks.find(t=>t.id===next.task.id);
  if(current){const base={...data,tasks:data.tasks.map(t=>t.id===current.id?lastQueued.current:t)},edited={...data,tasks:data.tasks.map(t=>t.id===current.id?next.task:t)},m=mergeWorkspaceDraft(base,data,edited);if(m.conflicts.length){setDraft(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{}setMessage('这项行动有同时修改的字段，草稿已保留。请核对后点击“完成”确认。');return;}next={...next,base:current,task:m.state.tasks.find(t=>t.id===current.id)!,focus:next.focus===draft.focus?importantTaskIds(data,focusDay).includes(current.id):next.focus};}
  setDraft(next);try{localStorage.setItem(key,JSON.stringify(next));}catch{setMessage('本机草稿保存失败，请保持页面打开。');}
  const parsed=taskSchema.safeParse(next.task);if(!parsed.success||!next.task.title.trim()){setMessage('草稿留在本机；补全任务名称和有效时间后会自动同步。');return;}
  setMessage('');void onSave(parsed.data,next.focus,true,eventId).then(ok=>{if(ok){lastQueued.current=parsed.data;try{localStorage.removeItem(key);}catch{}}else setMessage('暂未同步，草稿已保留，请检查页面提示。');});
 }
 function patch(value:Partial<Task>){change({...draft,task:{...draft.task,...value}});}
 function sessions(value:Session[]){change({...draft,task:withSessions(draft.task,value)});}
 function editSession(id:string,patch:Partial<Session>){sessions(draft.task.sessions.map(x=>x.id===id?{...x,...patch}:x));}
 async function submit(){
  const parsed=taskSchema.safeParse(draft.task);if(!parsed.success){setMessage(parsed.error.issues[0]?.message||'请检查日期和时间。');return;}
  let t=parsed.data;
  if(!isNew){const base={...data,tasks:data.tasks.map(x=>x.id===t.id?draft.base:x)},edited={...data,tasks:data.tasks.map(x=>x.id===t.id?t:x)},merged=mergeWorkspaceDraft(base,data,edited);if(merged.conflicts.length&&!confirm('这项任务在草稿保存后有其他更新。确认以当前表单覆盖冲突字段？其余云端内容会保留。'))return;t=merged.state.tasks.find(x=>x.id===t.id)!;}
  if(await onSave(t,draft.focus,false,eventId)){try{localStorage.removeItem(key);}catch{}}
 }
 const t=draft.task;
 return <form onSubmit={e=>{e.preventDefault();void submit();}}><fieldset disabled={busy} className="task-fieldset">
 {recovery&&<div className="draft-notice"><p>发现这个行动的未保存草稿。</p><button type="button" className="text-button" onClick={()=>{change(recovery);setRecovery(null);}}>恢复草稿</button><button type="button" className="text-button" onClick={()=>{if(confirm('丢弃这份本机草稿？云端记录不变。')){localStorage.removeItem(key);setRecovery(null);}}}>丢弃草稿</button></div>}
 <fieldset disabled={!!recovery} className="task-fieldset">
 <p className="draft-message" role="status">{message?'有内容尚未同步':syncLabel}</p>
 {message&&<p className="draft-message" role="status">{message}</p>}
 <label className="task-title-field">做什么<input required autoFocus value={t.title} maxLength={300} onChange={e=>patch({title:e.target.value})} placeholder="比如：整理明天开会要用的材料"/></label>
 <button type="button" className="task-focus-toggle" aria-pressed={draft.focus} onClick={()=>change({...draft,focus:!draft.focus})}><Star size={16} fill={draft.focus?'currentColor':'none'}/>{focusDay===dayKey()?'当天最重要的事':focusDay+' 的重点'}</button>
 <details className="task-details"><summary>项目与补充信息 <span>{data.projects.find(p=>p.id===t.projectId)?.name||'生活与精力'}</span></summary> <label>所属项目<select value={t.projectId} onChange={e=>patch({projectId:e.target.value as Task['projectId'],outcomeWeek:''})}>{data.projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="life">生活与精力</option></select></label>
 <label>怎样算完成<textarea value={t.note} maxLength={2000} onChange={e=>patch({note:e.target.value})}/></label>
 {t.projectId!=='life'&&<label>关联本周交付<select value={t.outcomeWeek} onChange={e=>patch({outcomeWeek:e.target.value})}><option value="">暂不关联</option>{data.plans.filter(p=>p.outcomes.some(o=>o.projectId===t.projectId&&o.deliverable)).map(p=><option key={p.week} value={p.week}>{p.week}｜{p.outcomes.find(o=>o.projectId===t.projectId)?.deliverable}</option>)}{t.outcomeWeek&&!data.plans.some(p=>p.week===t.outcomeWeek&&p.outcomes.some(o=>o.projectId===t.projectId&&o.deliverable))&&<option value={t.outcomeWeek}>{t.outcomeWeek}｜交付待补充</option>}</select></label>}
 <div className="form-inline"><label>截止日期（可留空）<input type="date" value={t.due} onInput={e=>patch({due:e.currentTarget.value})}/></label><label>状态<select value={t.status} onChange={e=>patch({status:e.target.value as Task['status']})}><option value="todo">待做</option><option value="doing">进行中</option><option value="done">已完成</option><option value="waiting">等待反馈</option><option value="paused">暂停</option><option value="cancelled">已取消（保留记录）</option></select></label></div>
</details>
 <details className="task-details"><summary>安排时间 <span>{t.sessions.some(s=>s.startTime)?t.sessions.map(s=>`${s.day.slice(5)} ${s.startTime||'待定'}`).join(' / '):'可以稍后安排'}</span></summary>
 <div className="session-editor"><div className="session-title"><h3>安排时间 · 可分多次做</h3><button type="button" className="text-button" onClick={()=>sessions([...t.sessions,{id:crypto.randomUUID(),day:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()),startTime:'',endTime:'',actual:'',plan:'',released:false}])}><Plus size={14}/>添加时段</button></div>
 {t.sessions.length===0&&<p className="help-text">可以先记任务，之后再安排时间。</p>}
 {t.sessions.map((s,i)=><div className={`session-edit-row ${s.released?'released':''}`} key={s.id}><div className="session-title"><strong>第 {i+1} 个时段{s.released?' · 已释放':''}</strong><button type="button" className="icon-button" aria-label={`移除第${i+1}个时段`} onClick={()=>{if(!s.actual||confirm('这个时段有实际记录。确认从任务中移除？保存时会留下原安排的变更记录。'))sessions(t.sessions.filter(x=>x.id!==s.id));}}><Trash2 size={14}/></button></div>
 <label>第{i+1}个时段日期<input type="date" required value={s.day} onInput={e=>editSession(s.id,{day:e.currentTarget.value})}/></label><div className="form-inline"><label>第{i+1}个时段开始<input type="time" value={s.startTime} onInput={e=>editSession(s.id,{startTime:e.currentTarget.value})}/></label><label>第{i+1}个时段结束<input type="time" value={s.endTime} onInput={e=>editSession(s.id,{endTime:e.currentTarget.value})}/></label></div>
 <details className="session-extras"><summary>这次的进展与调整</summary><label>第{i+1}个时段实际进展<textarea value={s.actual} maxLength={2000} onChange={e=>editSession(s.id,{actual:e.target.value})} placeholder="这一次做到了哪里？"/></label><label className="checkbox-label"><input type="checkbox" checked={s.released} onChange={e=>editSession(s.id,{released:e.target.checked})}/>释放这个安排，保留记录但不占用时间</label></details></div>)}
 </div>
 </details><details className="task-details"><summary>记录结果与进展</summary><label>整项任务的实际结果<textarea value={t.actual} maxLength={2000} onChange={e=>patch({actual:e.target.value})} placeholder="最终产出或整体进展；每次工作过程可写在上面的时段里。"/></label>
 {['waiting','paused'].includes(t.status)&&<label>下次跟进 / 再看日期<input type="date" value={t.followUpDay} onInput={e=>patch({followUpDay:e.currentTarget.value})}/></label>}
 {t.continuationNote&&<p className="help-text">上次接续：{t.continuationNote}</p>}
 </details>
 <div className="modal-actions"><button type="button" className="button secondary" onClick={onCancel}>关闭</button><button className="button primary" disabled={busy||!t.title.trim()}>完成</button></div>
 </fieldset></fieldset></form>;
}
