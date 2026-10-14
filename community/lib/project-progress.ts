import {checkInLabels,dayKey,logSchema,projectUpdateSchema,stateSchema,weekStart,type Log,type Project,type ProjectUpdate,type Workspace} from './workspace.ts';
import {getPlan} from './planning.ts';
export function projectHistory(s:Workspace,id:string,through='9999-12-31'){
 return s.logs.filter(l=>l.projectId===id&&l.day<=through&&(l.checkIn||l.kind==='note'||l.kind==='project')).sort((a,b)=>b.day.localeCompare(a.day)||b.createdAt.localeCompare(a.createdAt));
}
export function projectRecord(s:Workspace,id:string,day:string){
 const log=projectHistory(s,id,day).find(l=>l.day===day);if(log)return {text:log.text,label:log.checkIn?checkInLabels[log.checkIn.kind]:'已有记录',log};
 const plan=s.plans.find(p=>p.week===weekStart(day)),d=plan?.days.find(d=>d.day===day);
 const actual=[...(d?.hours.filter(h=>h.actualAllocation?.projectId===id&&h.actual.trim()).map(h=>h.actual)||[]),...(d?.blocks.filter(b=>b.field==='actual'&&b.allocation?.projectId===id&&b.text.trim()).map(b=>b.text)||[])];
 const tasks=s.tasks.filter(t=>t.projectId===id);actual.push(...tasks.flatMap(t=>t.sessions.filter(x=>x.day===day&&x.actual.trim()).map(x=>`${t.title}：${x.actual}`)));actual.push(...tasks.filter(t=>t.status==='done'&&t.completedAt&&dayKey(new Date(t.completedAt))===day).map(t=>`已完成：${t.title}`));
 return actual.length?{text:[...new Set(actual)].join('\n'),label:'已有实际记录',log:undefined}:null;
}
export function projectAttention(s:Workspace,day:string){
 const plan=getPlan(s,weekStart(day)),focus=plan.focusProjectIds||[];
 const entries=s.projects.map(p=>{
  const record=projectRecord(s,p.id,day),history=projectHistory(s,p.id,day),latest=history.find(l=>l.checkIn),tasks=s.tasks.filter(t=>t.projectId===p.id&&!['done','cancelled'].includes(t.status));
  const taskDue=tasks.some(t=>(t.due&&t.due<=day)||(t.followUpDay&&t.followUpDay<=day));
  const dated=!!((p.attentionDay&&p.attentionDay<=day)||(p.due&&p.due<=day)||taskDue);
  const scheduled=tasks.some(t=>t.sessions.some(x=>x.day===day&&!x.released)||t.focusDay===day);
  const focused=focus.includes(p.id)&&!plan.outcomes.some(o=>o.projectId===p.id&&o.done);
  const waiting=p.status==='等待反馈'||latest?.checkIn?.kind==='waiting';
  const futureAttention=!!p.attentionDay&&p.attentionDay>day;
  const eligible=p.status!=='已完成'&&(dated||(!futureAttention&&!waiting&&p.status!=='暂停'&&(scheduled||focused)));
  let adjustments=0;const seen=new Set<string>();for(const l of history.filter(l=>l.checkIn)){if(l.checkIn?.kind==='progress')break;if(['blocked','not_planned'].includes(l.checkIn!.kind)&&!seen.has(l.day)){seen.add(l.day);adjustments++;}}
  return {project:p,record,reason:dated?'到了约定关注的时间':scheduled?'今天有安排':'本周重点',rank:dated?0:scheduled?1:2,eligible,adjustments};
 });
 return {pending:entries.filter(e=>e.eligible&&!e.record).sort((a,b)=>a.rank-b.rank),recorded:entries.filter(e=>e.record),focus};
}
export function makeProjectLog(input:ProjectUpdate,day:string,id:string,at:string):Log{
 const u=projectUpdateSchema.parse(input);return {id,day,projectId:u.projectId,kind:'project',text:u.text,evidence:'',createdAt:at,checkIn:{kind:u.kind,...(u.next!==undefined?{next:u.next}:{}),...(u.attentionDay!==undefined?{attentionDay:u.attentionDay}:{})}};
}
export function applyProjectUpdate(s:Workspace,input:ProjectUpdate,day:string,id:string,at:string):Workspace{
 const u=projectUpdateSchema.parse(input),old=s.logs.find(l=>l.id===id);if(old&&(old.projectId!==u.projectId||old.day!==day||!old.checkIn))throw new Error('记录已变化，请重新打开项目');
 const later=s.logs.some(l=>l.projectId===u.projectId&&l.checkIn&&l.day>day);if(later&&(u.next!==undefined||u.attentionDay!==undefined))throw new Error('已有更晚的项目记录；补记历史时请保留当前下一步和关注日期');
 const log=makeProjectLog(u,day,id,old?.createdAt||at);
 const projects=s.projects.map(p=>p.id===u.projectId?{...p,...(u.next!==undefined?{next:u.next}:{}),...(u.attentionDay!==undefined?{attentionDay:u.attentionDay}:{}),...((u.next!==undefined||u.attentionDay!==undefined)?{updatedAt:at}:{})}:p);
 return stateSchema.parse({...s,projects,logs:old?s.logs.map(l=>l.id===id?log:l):[log,...s.logs]});
}

// Editing a historical entry never rolls the project's current next step back.
export function editProjectEntry(s:Workspace,projectId:string,id:string,text:string,kind:ProjectUpdate['kind']):Workspace{
 const old=projectHistory(s,projectId).find(l=>l.id===id);
 if(!old)throw new Error('这条记录已变化，请重新打开项目');
 const log=logSchema.parse({...old,text:text.trim(),...(old.checkIn?{checkIn:{...old.checkIn,kind}}:{})});
 return stateSchema.parse({...s,logs:s.logs.map(l=>l.id===id?log:l)});
}
