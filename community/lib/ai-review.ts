import {z} from 'zod';
import {projectUpdateSchema,allocationSchema,emptyAllocation,hasAllocation,hourLabel,projectIds,scheduleDefaults,stateSchema,weekStart,type Log,type Project,type Workspace,type Task,type TimeBlock} from './workspace.ts';
import {getPlan,putPlan,type DayPlan} from './planning.ts';
import {makeProjectLog} from './project-progress.ts';
import {hourHasContent} from './time-blocks.ts';
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{try{return new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;}catch{return false;}},'日期无效');
const project=z.union([z.enum(projectIds),z.literal('life'),z.literal('')]);
export const reviewContentSchema=z.object({
 projectUpdates:z.array(projectUpdateSchema).max(6).default([]),
 day,rawText:z.string().trim().min(1,'请保留口述原文').max(20000),
 times:z.array(z.object({start:z.number().int().min(8).max(21),end:z.number().int().min(9).max(22),text:z.string().trim().min(1,'请补充这段实际做的事').max(6000),allocation:allocationSchema.default(emptyAllocation),mode:z.enum(['add','replace']).default('add')}).strict().refine(t=>t.end>t.start,'结束时间必须晚于开始')).max(14).default([]),
 reflection:z.string().max(1800).default(''),unplaced:z.string().max(1800).default(''),
 nextActions:z.array(z.object({title:z.string().trim().min(1,'请补充下一步的名称').max(300),projectId:project.default(''),note:z.string().max(1500).default(''),due:z.union([day,z.literal('')]).default(''),include:z.boolean().default(false)}).strict()).max(10).default([])
}).strict().superRefine((v,c)=>{if(new Set(v.projectUpdates.map(p=>p.projectId)).size!==v.projectUpdates.length)c.addIssue({code:'custom',message:'每个项目在一份草稿中整理一次即可'});for(let i=0;i<v.times.length;i++)if(v.times.some((t,j)=>j!==i&&t.start<v.times[i].end&&t.end>v.times[i].start))c.addIssue({code:'custom',message:'草稿中的实际时段有重叠，请先核对。'});});
export type ReviewContent=z.infer<typeof reviewContentSchema>;
type ActualSnapshot={hours:Array<{hour:number;actual:string;actualAllocation?:z.infer<typeof allocationSchema>}>;blocks:TimeBlock[]};
type ProjectFields=Partial<Pick<Project,'next'|'attentionDay'>>;
type Patch={kind:'project';id:string;before:ProjectFields;after:ProjectFields}|{kind:'projectLog';id:string;before:Log|null;after:Log|null}|{kind:'actual';day:string;before:ActualSnapshot;after:ActualSnapshot}|{kind:'reflection';day:string;before:string;after:string}|{kind:'task';id:string;before:Task|null;after:Task|null};
export type ReviewPayload={content:ReviewContent;originalText:string;patches:Patch[];warnings:string[];createdAt:string};
export type ReviewRecord={id:string;version:number;status:'pending'|'applied'|'undone'|'dismissed';createdAt:string;updatedAt:string;payload:ReviewPayload};
export class ReviewError extends Error{status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export function same(a:unknown,b:unknown):boolean{if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]));const x=a as Record<string,unknown>,y=b as Record<string,unknown>;return Object.keys(x).length===Object.keys(y).length&&Object.keys(x).every(k=>Object.hasOwn(y,k)&&same(x[k],y[k]));}
function snapshot(d:DayPlan):ActualSnapshot{return {hours:d.hours.filter(h=>h.actual||hasAllocation(h.actualAllocation)).map(h=>({hour:h.hour,actual:h.actual,...(h.actualAllocation?{actualAllocation:h.actualAllocation}:{})})).sort((a,b)=>a.hour-b.hour),blocks:d.blocks.filter(b=>b.field==='actual').sort((a,b)=>a.start-b.start)};}
export function proposal(state:Workspace,input:ReviewContent,draftId:string,at:string,originalText=input.rawText):ReviewPayload{
 const content=reviewContentSchema.parse(input),d=getPlan(state,weekStart(content.day)).days.find(d=>d.day===content.day)!;
 let next=structuredClone(d);const patches:Patch[]=[],warnings:string[]=[];
 for(const [index,t] of content.times.entries()){
  const overlaps=next.blocks.filter(b=>b.field==='actual'&&b.start<t.end&&b.end>t.start);
  const occupied=next.hours.filter(h=>h.hour>=t.start&&h.hour<t.end&&(h.actual||hasAllocation(h.actualAllocation)));
  if(overlaps.some(b=>b.start<t.start||b.end>t.end))throw new ReviewError(`${hourLabel(t.start)}—${hourLabel(t.end)} 切到了已有合并时段，请保留整个原时段，或先在时间表拆分。`);
  const sameBlock=overlaps.length===1&&!occupied.length&&overlaps[0].start===t.start&&overlaps[0].end===t.end&&overlaps[0].text===t.text&&same(overlaps[0].allocation||emptyAllocation,t.allocation);
  const sameHour=t.end===t.start+1&&!overlaps.length&&occupied.length===1&&occupied[0].actual===t.text&&same(occupied[0].actualAllocation||emptyAllocation,t.allocation);
  if(sameBlock||sameHour){warnings.push(`${hourLabel(t.start)}—${hourLabel(t.end)} 已有相同记录，将跳过。`);continue;}
  if((overlaps.length||occupied.length)&&t.mode!=='replace')throw new ReviewError(`${hourLabel(t.start)}—${hourLabel(t.end)} 已有实际记录，请核对后将这一段标为“替换原记录”。`);
  if(overlaps.length||occupied.length)warnings.push(`${hourLabel(t.start)}—${hourLabel(t.end)} 将替换已有实际内容；原文保存在本次写入记录中。`);
  next={...next,blocks:[...next.blocks.filter(b=>!overlaps.includes(b)),{id:`ai-${draftId}-${index}`,field:'actual',start:t.start,end:t.end,text:t.text,allocation:t.allocation}],hours:next.hours.map(h=>{if(h.hour<t.start||h.hour>=t.end)return h;const row={...h,actual:''};delete row.actualAllocation;return row;}).filter(hourHasContent)};
 }
 const before=snapshot(d),after=snapshot(next);if(!same(before,after))patches.push({kind:'actual',day:d.day,before,after});
 const notes=[content.reflection.trim(),content.unplaced.trim()?'时间 / 项目待补：\n'+content.unplaced.trim():''].filter(Boolean);
 let reflection=d.reflection;for(const note of notes)if(!reflection.split('\n\n').includes(note)&&!reflection.endsWith(note))reflection=[reflection,note].filter(Boolean).join('\n\n');
 if(reflection.length>2000)throw new ReviewError('合并后的当天小结超过 2000 字，请缩短草稿小结；口述原文仍会保留在草稿中。');
 if(reflection!==d.reflection)patches.push({kind:'reflection',day:d.day,before:d.reflection,after:reflection});
 for(const [i,a] of content.nextActions.entries())if(a.include){
  if(!a.projectId)throw new ReviewError(`“${a.title}”需要先选择所属项目，或取消加入待办。`);
  if(state.tasks.some(t=>t.projectId===a.projectId&&t.title===a.title&&!['done','cancelled'].includes(t.status))||patches.some(p=>p.kind==='task'&&p.after?.projectId===a.projectId&&p.after.title===a.title)){warnings.push(`已有未完成待办“${a.title}”，将跳过重复创建。`);continue;}
  const task:Task={...scheduleDefaults,id:`ai-${draftId}-task-${i}`,title:a.title,projectId:a.projectId,note:a.note,due:a.due,focusDay:'',status:'todo',createdAt:at,completedAt:''};patches.push({kind:'task',id:task.id,before:null,after:task});
 }
 for(const [i,u] of content.projectUpdates.entries()){
  const p=state.projects.find(p=>p.id===u.projectId)!;
  if(state.logs.some(l=>l.projectId===u.projectId&&l.checkIn&&l.day>content.day)&&(u.next!==undefined||u.attentionDay!==undefined))throw new ReviewError('已有更晚的项目记录；补记历史时请保留当前下一步和关注日期。');
  const log=makeProjectLog(u,content.day,`ai-${draftId}-project-${i}`,at);
  const duplicate=state.logs.some(l=>l.day===content.day&&l.projectId===u.projectId&&l.text===log.text&&same(l.checkIn,log.checkIn));
  if(!duplicate)patches.push({kind:'projectLog',id:log.id,before:null,after:log});else warnings.push(`${p.name}已有相同进展记录，将跳过重复记录。`);
  const before:ProjectFields={},after:ProjectFields={};
  if(u.next!==undefined&&u.next!==p.next){before.next=p.next;after.next=u.next;}
  if(u.attentionDay!==undefined&&u.attentionDay!==(p.attentionDay||'')){before.attentionDay=p.attentionDay;after.attentionDay=u.attentionDay;}
  if(Object.keys(after).length)patches.push({kind:'project',id:p.id,before,after});
 }
 const payload={content,patches,warnings,originalText,createdAt:at};applyPatches(state,payload);return payload;
}
export function applyPatches(state:Workspace,payload:ReviewPayload,reverse=false):Workspace{
 let next=structuredClone(state);
 for(const p of payload.patches){const expected=reverse?p.after:p.before,value=reverse?p.before:p.after;
  if(p.kind==='projectLog'){
   const current=next.logs.find(l=>l.id===p.id)||null;if(!same(current,expected))throw new ReviewError('这条项目进展已有更新，请先核对；不会覆盖新内容。',409);
   next.logs=next.logs.filter(l=>l.id!==p.id);if(value)next.logs.unshift(value as Log);continue;
  }
  if(p.kind==='project'){
   const current=next.projects.find(x=>x.id===p.id)!;
   for(const key of Object.keys({...p.before,...p.after}) as Array<keyof ProjectFields>){if(!same(current[key],(expected as ProjectFields)[key]))throw new ReviewError('项目的下一步或关注日期已有更新，请先核对；不会覆盖新内容。',409);}
   next.projects=next.projects.map(x=>{if(x.id!==p.id)return x;const updated={...x};for(const key of Object.keys({...p.before,...p.after}) as Array<keyof ProjectFields>){const v=(value as ProjectFields)[key];if(v===undefined)delete (updated as any)[key];else updated[key]=v;}return updated;});continue;
  }
  if(p.kind==='task'){
   const current=next.tasks.find(t=>t.id===p.id)||null;if(!same(current,expected))throw new ReviewError('这项待办在草稿之后已有修改，请先核对；不会覆盖新内容。',409);
   next.tasks=next.tasks.filter(t=>t.id!==p.id);if(value)next.tasks.push(value as Task);continue;
  }
  const plan=getPlan(next,weekStart(p.day)),d=plan.days.find(d=>d.day===p.day)!;
  if(p.kind==='actual'){
   if(!same(snapshot(d),expected))throw new ReviewError('当天实际时间表已有更新，请重新核对草稿；不会覆盖新内容。',409);
   const actual=value as ActualSnapshot;d.blocks=[...d.blocks.filter(b=>b.field!=='actual'),...actual.blocks];
   const map=new Map(d.hours.map(h=>{const row={...h,actual:''};delete row.actualAllocation;return [h.hour,row] as const;}));
   for(const h of actual.hours)map.set(h.hour,{...(map.get(h.hour)||{hour:h.hour,plan:'',actual:''}),...h});d.hours=[...map.values()].filter(hourHasContent).sort((a,b)=>a.hour-b.hour);
  }else{if(d.reflection!==expected)throw new ReviewError('当天小结已有更新，请先核对；不会覆盖新内容。',409);d.reflection=value as string;}
  // Preserve week metadata and only add/update the affected day, so undo doesn't erase unrelated planning.
  const existing=next.plans.find(x=>x.week===plan.week);const updated={...(existing||{week:plan.week,focus:'',outcomes:[],days:[]}),days:existing?.days.some(x=>x.day===p.day)?existing.days.map(x=>x.day===p.day?d:x):[...(existing?.days||[]),d]};next=putPlan(next,updated);
 }
 const result=stateSchema.parse(next);if(new TextEncoder().encode(JSON.stringify(result)).length>900000)throw new ReviewError('工作台记录接近保存上限，请先导出备份。');return result;
}
export function reviewPreview(payload:ReviewPayload){return payload.patches.map(p=>p.kind==='actual'?{kind:'实际时间表',day:p.day,before:p.before,after:p.after}:p.kind==='reflection'?{kind:'当天小结',day:p.day,before:p.before,after:p.after}:{kind:p.kind==='project'?'项目下一步与关注日期':p.kind==='projectLog'?'项目进展':'新增待办',...(p.kind==='project'?{projectId:p.id}:{}),before:p.before,after:p.after});}
export function blankReview(day:string,rawText=''):ReviewContent{return {day,rawText,projectUpdates:[],times:[],reflection:'',unplaced:'',nextActions:[]};}
