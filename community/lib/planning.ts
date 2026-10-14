import { addDays, dayKey, hourLabel, hasAllocation, planSchema, scheduleDefaults, taskStatusLabel, withSessions, type Session, type Task, type Workspace } from './workspace.ts';
export type Plan=Workspace['plans'][number];
export type DayPlan=Plan['days'][number];
export function getPlan(data:Workspace,week:string):Plan {
 const old=data.plans.find(p=>p.week===week);
 return planSchema.parse({week,focus:old?.focus||'',...(old?.focusProjectIds?{focusProjectIds:old.focusProjectIds}:{}),outcomes:data.projects.map(p=>old?.outcomes.find(o=>o.projectId===p.id)||{projectId:p.id,deliverable:'',acceptance:'',result:'',done:false}),days:Array.from({length:7},(_,i)=>{
  const day=addDays(week,i),row=old?.days.find(d=>d.day===day);
  return {...(row||{day,reflection:'',hours:[],capacityMinutes:null}),anchorTaskIds:[...new Set([...(row?.anchorTaskIds||[]),...data.tasks.filter(t=>t.focusDay===day).map(t=>t.id)])]};})});
}
export function putPlan(s:Workspace,p:Plan):Workspace{return {...s,plans:s.plans.some(x=>x.week===p.week)?s.plans.map(x=>x.week===p.week?p:x):[...s.plans,p]};}
export const minute=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
function unionMinutes(ranges:number[][]){let total=0,end=-1;for(const [a,b] of [...ranges].sort((a,b)=>a[0]-b[0])){total+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}return total;}
export function dailyCapacity(tasks:Task[],d:DayPlan){
 const sessions=tasks.filter(t=>t.status!=='cancelled').flatMap(t=>t.sessions.filter(x=>x.day===d.day&&!x.released));
 const timed=sessions.filter(x=>x.startTime&&x.endTime).map(x=>[minute(x.startTime),minute(x.endTime)]);
 const duration=timed.reduce((n,[a,b])=>n+b-a,0),occupied=unionMinutes(timed);
 const noteRanges=[...d.hours.filter(h=>h.plan.trim()||hasAllocation(h.planAllocation)).map(h=>[h.hour*60,(h.hour+1)*60]),...d.blocks.filter(b=>b.field==='plan'&&(b.text.trim()||hasAllocation(b.allocation))).map(b=>[b.start*60,b.end*60])];
 const noteMinutes=unionMinutes([...timed,...noteRanges])-occupied;
 const unslottedPriority=tasks.filter(t=>d.anchorTaskIds.includes(t.id)&&!['done','cancelled','waiting','paused'].includes(t.status)&&!t.sessions.some(x=>x.day===d.day&&!x.released)).length;
 return {planned:duration+noteMinutes,noteMinutes,overlap:duration-occupied,unknown:sessions.filter(x=>!x.startTime||!x.endTime).length+unslottedPriority,available:d.capacityMinutes,remaining:d.capacityMinutes===null?null:d.capacityMinutes-duration-noteMinutes};
}
export function sessionInHour(s:Session,day:string,hour:number){return s.day===day&&!!s.startTime&&minute(s.startTime)<(hour+1)*60&&(s.endTime?minute(s.endTime)>hour*60:minute(s.startTime)>=hour*60);}
export function sessionFirstHour(s:Session){return Math.max(8,Math.floor(minute(s.startTime)/60));}
export function taskSessionsText(t:Task){return t.sessions.map(s=>`${s.day} ${s.startTime}${s.endTime?'–'+s.endTime:''}${s.released?'（已释放）':''}${s.plan?'；计划：'+s.plan:''}${s.actual?'；实际：'+s.actual:''}`).join('\n');}

// Three-way merge preserves cloud changes to untouched fields and reports conflicting edits.
export function mergeWorkspaceDraft(base:Workspace,current:Workspace,draft:Workspace){
 const conflicts:string[]=[];const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 const object=(v:any)=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 function merge(b:any,c:any,d:any,path:string):any{
  if(equal(d,b))return c;if(equal(c,b)||equal(c,d))return d;
  if(Array.isArray(c)&&Array.isArray(d)&&(!b||Array.isArray(b))){
   const before=b||[],all=[...before,...c,...d];
   const key=['id','week','day','hour','projectId'].find(k=>all.length&&all.every(v=>object(v)&&Object.hasOwn(v,k)));
   if(key){const bm=new Map(before.map((v:any)=>[v[key],v])),cm=new Map(c.map((v:any)=>[v[key],v])),dm=new Map(d.map((v:any)=>[v[key],v]));return [...new Set([...cm.keys(),...dm.keys()])].map(k=>merge(bm.get(k),cm.get(k),dm.get(k),`${path}/${String(k)}`)).filter(x=>x!==undefined);}
   if(all.every(v=>typeof v==='string'))return [...new Set([...c.filter(v=>!before.includes(v)||d.includes(v)),...d.filter(v=>!before.includes(v))])];
  }
  if(object(c)&&object(d)&&(!b||object(b))){const out:any={};for(const k of new Set([...Object.keys(b||{}),...Object.keys(c),...Object.keys(d)])){const value=merge(b?.[k],c[k],d[k],`${path}/${k}`);if(value!==undefined)out[k]=value;}return out;}
  conflicts.push(path);return d;
 }
 return {state:merge(base,current,draft,'') as Workspace,conflicts};
}
export type Continuation={mode:'continue'|'split'|'waiting'|'paused'|'resume'|'done'|'cancelled';fromDay:string;targetDay:string;startTime:string;endTime:string;note:string;children:string[]};
export function continueTask(state:Workspace,taskId:string,input:Continuation,at:string,newId:()=>string):Workspace{
 const t=state.tasks.find(t=>t.id===taskId);if(!t)throw new Error('找不到原任务');if(['done','cancelled'].includes(t.status))throw new Error('请先重新打开任务再接续');
 let task={...t,continuationNote:input.note,completedAt:''},children:Task[]=[];
 const release=()=>t.sessions.map(s=>s.day>=input.fromDay?{...s,released:true}:s);
 const closing=input.mode==='done'||input.mode==='cancelled';
 if(closing){
  task=withSessions({...task,status:input.mode as 'done'|'cancelled',completedAt:input.mode==='done'?at:'',followUpDay:'',continuationNote:input.note||t.continuationNote},t.sessions.map(s=>s.day>dayKey(new Date(at))?{...s,released:true}:s));
 }else if(input.mode==='continue'){
  if(!input.targetDay||input.targetDay<input.fromDay)throw new Error('接续日期不能早于所选日期');
  if(input.endTime&&(!input.startTime||input.endTime<=input.startTime))throw new Error('结束时间必须晚于开始时间');
  const session:Session={id:newId(),day:input.targetDay,startTime:input.startTime,endTime:input.endTime,actual:'',plan:'',released:false};
  task=withSessions({...task,status:'todo',followUpDay:''},[...release(),session]);
 }else if(input.mode==='split'){
  const titles=input.children.map(x=>x.trim()).filter(Boolean);if(titles.length<2||titles.length>10)throw new Error('请填写2—10个小行动，每行一个');if(titles.some(x=>x.length>300))throw new Error('每个小行动最多300字');
  task=withSessions({...task,status:'paused',followUpDay:''},release());
  children=titles.map(title=>({...scheduleDefaults,id:newId(),projectId:t.projectId,title,note:'拆自：'+t.title,due:'',focusDay:'',status:'todo',createdAt:at,completedAt:'',parentTaskId:t.id,outcomeWeek:t.outcomeWeek}));
 }else if(input.mode==='resume'){task={...task,status:'todo',followUpDay:''};}
 else {task=withSessions({...task,status:input.mode,followUpDay:input.targetDay},release());}
 const action={continue:'继续安排',split:'拆成小行动',waiting:'等待反馈',paused:'暂停',resume:'恢复待办',done:'完成行动',cancelled:'不再做（关闭）'}[input.mode];
 const log={id:newId(),projectId:t.projectId,text:`${action}：${t.title}\n原安排：${taskSessionsText(t)||'未排期'}${!closing&&input.targetDay?'\n接续 / 跟进：'+input.targetDay:''}${input.note?'\n说明：'+input.note:''}${children.length?'\n拆分为：'+children.map(x=>x.title).join('；'):''}`,evidence:'',createdAt:at,day:dayKey(new Date(at)),kind:'task' as const};
 return {...state,tasks:[...state.tasks.map(x=>x.id===t.id?task:x),...children],logs:[log,...state.logs]};
}
