import { z } from "zod";
export const projectIds = ["P1", "P2", "P3", "P4", "P5", "P6"] as const;
export const projectStatuses = ["进行中", "等待反馈", "待补充", "暂停", "已完成"] as const;
const day = z.string().refine(v => { if(v==='')return true; if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false; const d=new Date(v+'T00:00:00Z'); return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v; }, '日期无效');
const clockTime = z.union([z.literal(''),z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]);
export const scheduleDefaults={scheduledDay:'',startTime:'',endTime:'',actual:'',sessions:[] as Session[],followUpDay:'',continuationNote:'',parentTaskId:'',outcomeWeek:''};
const timestamp = z.string().datetime();
const projectSchema = z.object({id:z.enum(projectIds),name:z.string().min(1).max(80),purpose:z.string().max(500),status:z.enum(projectStatuses),summary:z.string().max(3000),next:z.string().max(1000),due:day,attentionDay:day.optional(),updatedAt:timestamp});
export const sessionSchema=z.object({id:z.string().min(1).max(80),day:day.refine(v=>!!v),startTime:clockTime,endTime:clockTime,actual:z.string().max(2000).default(''),plan:z.string().max(2000).default(''),released:z.boolean().default(false)}).superRefine((s,c)=>{if(s.endTime&&(!s.startTime||s.endTime<=s.startTime))c.addIssue({code:'custom',message:'结束时间必须晚于开始时间'});});
export type Session=z.infer<typeof sessionSchema>;
export const taskSchema = z.object({id:z.string().min(1).max(80),projectId:z.union([z.enum(projectIds),z.literal('life')]),scheduledDay:day.default(''),startTime:clockTime.default(''),endTime:clockTime.default(''),actual:z.string().max(2000).default(''),title:z.string().min(1).max(300),note:z.string().max(2000),due:day,focusDay:day,status:z.enum(['todo','doing','done','cancelled','waiting','paused']),createdAt:timestamp,completedAt:z.union([timestamp,z.literal('')]),sessions:z.array(sessionSchema).max(300).optional(),followUpDay:day.default(''),continuationNote:z.string().max(2000).default(''),parentTaskId:z.string().max(80).default(''),outcomeWeek:day.refine(v=>!v||weekStart(v)===v).default('')}).superRefine((t,c)=>{
 if((t.startTime||t.endTime)&&!t.scheduledDay)c.addIssue({code:'custom',message:'时间安排需要日期'});
 if(t.endTime&&(!t.startTime||t.endTime<=t.startTime))c.addIssue({code:'custom',message:'结束时间必须晚于开始时间'});
 if(t.sessions&&new Set(t.sessions.map(x=>x.id)).size!==t.sessions.length)c.addIssue({code:'custom',message:'任务时段重复'});
}).transform(t=>{
 const sessions=t.sessions??(t.scheduledDay?[{id:'legacy-schedule',day:t.scheduledDay,startTime:t.startTime,endTime:t.endTime,actual:'',plan:'',released:false}]:[]);
 const first=sessions[0];return {...t,sessions,scheduledDay:first?.day||'',startTime:first?.startTime||'',endTime:first?.endTime||''};
});
export const taskDraftSchema=taskSchema.innerType().innerType().extend({title:z.string().max(300),sessions:z.array(sessionSchema.innerType().extend({day:z.string().max(10)})).max(300).default([])});
export const taskStatusLabel=(s:Task['status'])=>({todo:'待做',doing:'进行中',done:'已完成',cancelled:'已取消',waiting:'等待反馈',paused:'暂停'}[s]);
export function withSessions(t:Task,sessions:Session[]):Task{return {...t,sessions,scheduledDay:sessions[0]?.day||'',startTime:sessions[0]?.startTime||'',endTime:sessions[0]?.endTime||''};}
export function taskOnDay(t:Task,day:string){return t.sessions.some(s=>s.day===day);}
export const checkInKinds=['progress','blocked','not_planned','waiting','later'] as const;
export const checkInLabels={progress:'有进展',blocked:'遇到卡点',not_planned:'今天不安排',waiting:'等待反馈',later:'稍后再看'};
export const projectUpdateSchema=z.object({projectId:z.enum(projectIds),kind:z.enum(checkInKinds),text:z.string().trim().min(1,'说一句进展或原因就好').max(2000),next:z.string().max(1000).optional(),attentionDay:day.optional()}).strict();
export type ProjectUpdate=z.infer<typeof projectUpdateSchema>;
export const logSchema = z.object({id:z.string().min(1).max(80),projectId:z.union([z.enum(projectIds),z.literal("life")]),text:z.string().max(20000),capture:z.boolean().optional(),unclassified:z.boolean().optional(),evidence:z.string().max(2000),createdAt:timestamp,day:day.refine(v=>!!v),kind:z.enum(["note","task","project"]),checkIn:z.object({kind:z.enum(checkInKinds),next:z.string().max(1000).optional(),attentionDay:day.optional()}).optional()}).superRefine((l,c)=>{if(!l.capture&&l.text.length===0)c.addIssue({code:'custom',message:'请保留一条有效记录'});});
export const hours=Array.from({length:14},(_,i)=>i+8);
export const hourLabel=(hour:number)=>String(hour).padStart(2,'0')+':00';
export const timeCategories=['investment','consumption','debt'] as const;
export const categoryLabels={investment:'投资',consumption:'消费',debt:'负债'};
export const allocationSchema=z.object({projectId:z.union([z.enum(projectIds),z.literal('life'),z.literal('')]),category:z.union([z.enum(timeCategories),z.literal('')])});
export type TimeAllocation=z.infer<typeof allocationSchema>;
export const emptyAllocation:TimeAllocation={projectId:'',category:''};
export const hasAllocation=(a?:TimeAllocation)=>a!==undefined;
export function allocationLabel(a?:TimeAllocation){return a?`〔${a.projectId==='life'?'生活与精力':a.projectId||'项目未分类'} / ${a.category?categoryLabels[a.category]:'类型未分类'}〕`:'';}
export const timeBlockSchema=z.object({id:z.string().min(1).max(80),field:z.enum(['plan','actual']),start:z.number().int().min(8).max(21),end:z.number().int().min(9).max(22),text:z.string().max(30000),allocation:allocationSchema.optional()}).refine(b=>b.end>b.start,'结束时间必须晚于开始时间');
export type TimeBlock=z.infer<typeof timeBlockSchema>;
const dayPlanSchema=z.object({
 blocks:z.array(timeBlockSchema).max(28).default([]),
 day:day.refine(v=>!!v),anchorTaskId:z.string().max(80).optional(),
 anchorTaskIds:z.array(z.string().min(1).max(80)).max(1500).default([]),
 hours:z.array(z.object({hour:z.number().int().min(8).max(21),plan:z.string().max(30000),actual:z.string().max(30000),planAllocation:allocationSchema.optional(),actualAllocation:allocationSchema.optional()})).max(14).default([]),
 reflection:z.string().max(20000),capacityMinutes:z.number().int().min(0).max(1440).nullable().default(null)
}).transform(({anchorTaskId,anchorTaskIds,...rest})=>({...rest,anchorTaskIds:[...new Set([...anchorTaskIds,...(anchorTaskId?[anchorTaskId]:[])])]}));
export const outcomeSchema=z.object({projectId:z.enum(projectIds),deliverable:z.string().max(2000),acceptance:z.string().max(2000),result:z.string().max(2000),done:z.boolean()});
export const planSchema=z.object({focusProjectIds:z.array(z.enum(projectIds)).max(3,'本周最多关注三项重点').refine(v=>new Set(v).size===v.length,'重点项目重复').optional(),outcomes:z.array(outcomeSchema).max(6).default([]),week:day.refine(v=>!!v&&weekStart(v)===v),focus:z.string().max(4000),days:z.array(dayPlanSchema).max(7)});
export const stateSchema = z.object({schemaVersion:z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4),z.literal(5),z.literal(6),z.literal(7),z.literal(8)]).transform(()=>8 as const),displayName:z.string().max(40).default(''),plans:z.array(planSchema).max(520).default([]),projects:z.array(projectSchema).length(6),tasks:z.array(taskSchema).max(1500),logs:z.array(logSchema).max(3000),northStar:z.string().max(2000),reviews:z.array(z.object({id:z.string().max(80),week:day.refine(v=>!!v),text:z.string().max(20000),parts:z.object({analysis:z.string().max(20000).default(''),feelings:z.string().max(20000).default(''),direction:z.string().max(4000).default(''),next1:z.string().max(1000).default(''),next2:z.string().max(1000).default(''),next3:z.string().max(1000).default(''),supplement:z.string().max(30000).default('')}).optional(),createdAt:timestamp})).max(300)}).superRefine((s,c)=>{
  if(new Set(s.projects.map(p=>p.id)).size!==6)c.addIssue({code:"custom",message:"六类项目不能重复或缺失"});
  if(new Set(s.plans.map(p=>p.week)).size!==s.plans.length)c.addIssue({code:'custom',message:'周计划重复'});
  for(const t of s.tasks){if(t.parentTaskId&&(t.parentTaskId===t.id||!s.tasks.some(x=>x.id===t.parentTaskId)))c.addIssue({code:'custom',message:'原任务不存在'});}
  for(const p of s.plans){if(new Set(p.outcomes.map(o=>o.projectId)).size!==p.outcomes.length)c.addIssue({code:'custom',message:'项目交付重复'});if(new Set(p.days.map(d=>d.day)).size!==p.days.length)c.addIssue({code:'custom',message:'每日记录重复'});for(const d of p.days){if(d.day<p.week||d.day>addDays(p.week,6))c.addIssue({code:'custom',message:'日期不在本周'});if(d.anchorTaskIds.some(id=>!s.tasks.some(t=>t.id===id)))c.addIssue({code:'custom',message:'每日重点不存在'});if(new Set(d.blocks.map(b=>b.id)).size!==d.blocks.length)c.addIssue({code:'custom',message:'合并时段编号重复'});for(const b of d.blocks){if(d.blocks.some(x=>x.id!==b.id&&x.field===b.field&&x.start<b.end&&x.end>b.start))c.addIssue({code:'custom',message:'同一栏的合并时段不能重叠'});if(d.hours.some(h=>h.hour>=b.start&&h.hour<b.end&&(h[b.field]||hasAllocation(h[b.field==='plan'?'planAllocation':'actualAllocation']))))c.addIssue({code:'custom',message:'合并时段内有未合入的小时记录，请先拆分后整理'});}if(new Set(d.hours.map(h=>h.hour)).size!==d.hours.length)c.addIssue({code:'custom',message:'小时记录重复'});}}
  for(const key of ["tasks","logs","reviews"] as const) if(new Set(s[key].map(x=>x.id)).size!==s[key].length)c.addIssue({code:"custom",message:"记录编号重复"});
});
export type Workspace = z.infer<typeof stateSchema>;
export type Project = Workspace['projects'][number];
export type Task = Workspace['tasks'][number];
export type Log = Workspace['logs'][number];
export function dayKey(date = new Date()) {return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function addDays(day:string,n:number) {const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekStart(day:string) {const n=new Date(day+'T12:00:00Z').getUTCDay();return addDays(day,-((n+6)%7));}
export function importantTaskIds(s:Workspace,day:string):string[]{
 return [...new Set([...(s.plans.find(p=>p.week===weekStart(day))?.days.find(d=>d.day===day)?.anchorTaskIds||[]),...s.tasks.filter(t=>t.focusDay===day).map(t=>t.id)])];
}
export function setDailyFocus(s:Workspace,day:string,ids:string[]):Workspace{
 const week=weekStart(day),old=s.plans.find(p=>p.week===week)||{week,focus:'',days:[],outcomes:[]};
 const row={...(old.days.find(d=>d.day===day)||{day,reflection:'',hours:[],blocks:[],capacityMinutes:null}),anchorTaskIds:ids};
 const plan={...old,days:old.days.some(d=>d.day===day)?old.days.map(d=>d.day===day?row:d):[...old.days,row]};
 return {...s,plans:s.plans.some(p=>p.week===week)?s.plans.map(p=>p.week===week?plan:p):[...s.plans,plan],tasks:s.tasks.map(t=>({...t,focusDay:ids.includes(t.id)?day:t.focusDay===day?'':t.focusDay}))};
}
function dayPlanText(s:Workspace,d:Workspace['plans'][number]['days'][number]){
 return `- ${d.day} 当天最重要的事：${importantTaskIds(s,d.day).map(id=>s.tasks.find(t=>t.id===id)?.title).filter(Boolean).join('；')||'未选'}\n${d.hours.filter(h=>h.plan||h.actual||hasAllocation(h.planAllocation)||hasAllocation(h.actualAllocation)).sort((a,b)=>a.hour-b.hour).map(h=>`  - ${hourLabel(h.hour)}–${hourLabel(h.hour+1)}｜计划：${h.plan||'未填'}${allocationLabel(h.planAllocation)}｜实际：${h.actual||'未填'}${allocationLabel(h.actualAllocation)}`).join('\n')}\n${d.blocks.map(b=>`  - ${hourLabel(b.start)}–${hourLabel(b.end)}｜${b.field==='plan'?'计划':'实际'}（合并时段）：${b.text||'未填'}${allocationLabel(b.allocation)}`).join('\n')}\n  可用时间：${d.capacityMinutes===null?'未设置':d.capacityMinutes+'分钟'}\n  小结：${d.reflection||'未记录'}`;
}
export function seedState():Workspace {
 const at=new Date().toISOString();
 return {schemaVersion:8,displayName:'',plans:[],projects:projectIds.map((id,i)=>({id,name:`项目 ${i+1}`,purpose:'',status:'待补充',summary:'',next:'',due:'',updatedAt:at})),tasks:[],logs:[],reviews:[],northStar:''};
}
export function makeReview(s:Workspace, start:string) {
 const end=addDays(start,6), within=(d:string)=>d>=start&&d<=end;
 const logs=s.logs.filter(l=>within(l.day)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 const done=s.tasks.filter(t=>t.status==='done'&&t.completedAt&&within(dayKey(new Date(t.completedAt))));
 const plan=s.plans.find(p=>p.week===start);
 const scheduled=s.tasks.filter(t=>t.sessions.some(x=>within(x.day))&&t.status!=='cancelled');
 const pending=s.tasks.filter(t=>!['done','cancelled'].includes(t.status)&&((t.due&&within(t.due))||(t.focusDay&&within(t.focusDay))||t.sessions.some(x=>within(x.day))));
 const name=(id:string)=>s.projects.find(p=>p.id===id)?.name||'生活与精力';
 return `# Leo周回顾｜${start} — ${end}\n\n> 根据网页中已保存的记录汇总，不是AI分析；没有记录不等于没有行动。\n\n## 本周计划与实际\n${plan?.focus||'未填写本周重点。'}\n${plan?outcomesText(s,plan):''}\n${scheduled.map(t=>`- ${name(t.projectId)}：${t.title}（${taskStatusLabel(t.status)}）${t.actual?'；任务结果：'+t.actual:''}\n${t.sessions.filter(x=>within(x.day)).map(x=>`  - ${sessionText(x)}`).join('\n')}`).join('\n')}\n${plan?.days.map(d=>dayPlanText(s,d)).join('\n')||''}\n\n## 本周完成\n${done.length?done.map(t=>`- ${name(t.projectId)}：${t.title}`).join('\n'):'- 暂无已标记完成的任务，可补充实际成果。'}\n\n## 本周进展与证据\n${logs.length?logs.map(l=>`- ${l.day} · ${l.unclassified?'未分类':name(l.projectId)}：${l.text}${l.checkIn?'\n  项目接续：'+checkInLabels[l.checkIn.kind]+(l.checkIn.next!==undefined?'；下一步：'+(l.checkIn.next||'留空'):'')+(l.checkIn.attentionDay!==undefined?'；下次关注：'+(l.checkIn.attentionDay||'未设置'):''):''}${l.evidence?'\n  证据：'+l.evidence:''}`).join('\n'):'- 暂无记录。'}\n\n## 需要接续\n${pending.length?pending.map(t=>`- ${name(t.projectId)}：${t.title}（${taskStatusLabel(t.status)}；跟进 ${t.followUpDay||t.due||'待安排'}${t.continuationNote?'；'+t.continuationNote:''}）`).join('\n'):'- 本周没有已排期的未完成任务。'}\n\n## 我的判断与下周重点\n- 本周最有价值的结果：\n- 需要调整或减少什么：\n- 下周重点（最多三项）：\n- 家庭、关系与精力安排：\n`;
}
export function exportMarkdown(s:Workspace) {
 return `# Leo行动台｜${dayKey()}\n\n## 长期方向\n${s.northStar}\n\n## 项目与下一步\n${s.projects.map(p=>`### ${p.id} ${p.name}\n- 状态：${p.status}\n- 当前：${p.summary}\n- 下一步：${p.next}\n- 截止日期：${p.due||'待确认'}\n- 下次关注：${p.attentionDay||'未约定'}\n`).join('\n')}\n## 行动\n${s.tasks.filter(t=>t.status!=='cancelled').map(t=>`- [${t.status==='done'?'x':' '}] ${t.title}（${t.projectId}；${t.due||'未排截止日期'}）${t.sessions.map(x=>'\n  '+sessionText(x)).join('')}\n  状态：${taskStatusLabel(t.status)}${t.outcomeWeek?'；关联周成果：'+t.outcomeWeek:''}${t.parentTaskId?'；原任务：'+(s.tasks.find(x=>x.id===t.parentTaskId)?.title||t.parentTaskId):''}${t.continuationNote?'\n  接续：'+t.continuationNote:''}${t.followUpDay?'；跟进日期：'+t.followUpDay:''}${t.actual?'\n  实际：'+t.actual:''}${t.note?'\n  '+t.note:''}`).join('\n')}\n\n## 进展记录\n${s.logs.map(l=>`- ${l.day} · ${l.unclassified?'未分类':l.projectId==='life'?'生活':l.projectId}：${l.text}${l.checkIn?'\n  项目接续：'+checkInLabels[l.checkIn.kind]+(l.checkIn.next!==undefined?'；下一步：'+(l.checkIn.next||'留空'):'')+(l.checkIn.attentionDay!==undefined?'；下次关注：'+(l.checkIn.attentionDay||'未设置'):''):''}${l.evidence?'\n  证据：'+l.evidence:''}`).join('\n')}\n\n## 每周规划\n${s.plans.map(p=>`### ${p.week}\n${p.focus}\n${outcomesText(s,p)}\n${p.days.map(d=>dayPlanText(s,d)).join('\n')}`).join('\n\n')}\n\n## 保存的周回顾\n${s.reviews.map(r=>[r.text,r.parts?`## ${r.week} 周复盘补充\n\n### 分析\n${r.parts.analysis}\n\n### 阶段方向\n${r.parts.direction}\n\n### 感受\n${r.parts.feelings}\n\n### 下周想法\n${[r.parts.next1,r.parts.next2,r.parts.next3].filter(Boolean).join('\n')}\n\n### 补充原文\n${r.parts.supplement}`:''].filter(Boolean).join('\n\n')).join('\n\n---\n\n')}\n`;
}

export function sessionText(s:Session){return `${s.day} ${s.startTime||'时间待定'}${s.endTime?'–'+s.endTime:''}${s.released?'（已释放安排，保留历史）':''}${s.plan?'；计划：'+s.plan:''}${s.actual?'；实际：'+s.actual:''}`;}
function outcomesText(s:Workspace,p:Workspace['plans'][number]){return p.outcomes.filter(o=>o.deliverable||o.acceptance||o.result).map(o=>`- ${s.projects.find(x=>x.id===o.projectId)?.name} 本周交付：${o.deliverable||'待补充'}\n  验收：${o.acceptance||'待补充'}；${o.done?'已验收':'未验收'}\n  实际成果：${o.result||'未记录'}`).join('\n');}
