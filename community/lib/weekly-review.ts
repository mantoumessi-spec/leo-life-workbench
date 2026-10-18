import {addDays,dayKey,hourLabel,taskStatusLabel,weekStart,type Workspace,type Log,type Task,type TimeAllocation} from './workspace.ts';
import {getPlan,putPlan} from './planning.ts';
export type ReviewParts=NonNullable<Workspace['reviews'][number]['parts']>;
export const emptyReviewParts:ReviewParts={analysis:'',feelings:'',direction:'',next1:'',next2:'',next3:'',supplement:''};
export type Fact={id:string;day:string;text:string;source:string;projectId:string;time:string;kind:'actual'|'plan'|'reflection'|'change';logId?:string;sources:string[]};
export function weekFacts(s:Workspace,week:string):Fact[]{
 const out:Fact[]=[],end=addDays(week,6),within=(d:string)=>d>=week&&d<=end;
 const add=(f:Omit<Fact,'sources'>)=>{if(f.text.trim())out.push({...f,sources:[f.source]});};
 for(const d of s.plans.find(p=>p.week===week)?.days||[]){
  for(const h of d.hours)for(const field of ['actual','plan'] as const)add({id:`hour:${d.day}:${h.hour}:${field}`,day:d.day,text:h[field],source:'时间表',projectId:h[field==='actual'?'actualAllocation':'planAllocation']?.projectId||'',time:`${hourLabel(h.hour)}—${hourLabel(h.hour+1)}`,kind:field});
  for(const b of d.blocks)add({id:`block:${b.id}`,day:d.day,text:b.text,source:'合并时段',projectId:b.allocation?.projectId||'',time:`${hourLabel(b.start)}—${hourLabel(b.end)}`,kind:b.field});
  add({id:`reflection:${d.day}`,day:d.day,text:d.reflection,source:'当天小结',projectId:'',time:'',kind:'reflection'});
 }
 for(const t of s.tasks){
  for(const x of t.sessions.filter(x=>within(x.day))){
   add({id:`task:${t.id}:${x.id}:actual`,day:x.day,text:x.actual?`${t.title}：${x.actual}`:'',source:'任务实际进展',projectId:t.projectId,time:'',kind:'actual'});
   if(!x.released&&t.status!=='cancelled')add({id:`task:${t.id}:${x.id}:plan`,day:x.day,text:t.title+(x.plan?'：'+x.plan:''),source:'任务安排',projectId:t.projectId,time:x.startTime+(x.endTime?'—'+x.endTime:''),kind:'plan'});
  }
  if(t.status==='done'&&t.completedAt&&within(dayKey(new Date(t.completedAt))))add({id:`done:${t.id}`,day:dayKey(new Date(t.completedAt)),text:`已完成：${t.title}${t.actual?'\n'+t.actual:''}`,source:'任务完成记录',projectId:t.projectId,time:'',kind:'actual'});
 }
 for(const l of s.logs.filter(l=>within(l.day)))add({id:`log:${l.id}`,logId:l.id,day:l.day,text:l.text,source:l.capture?'随手记':l.kind==='task'?'操作记录':'项目进展',projectId:l.unclassified?'':l.projectId,time:'',kind:l.kind==='task'?'change':'actual'});
 // Collapse only identical entries on the same day with identical classification/time.
 // Source records remain untouched and every origin remains visible.
 const grouped=new Map<string,Fact>();
 for(const f of out){const key=JSON.stringify([f.day,f.kind,f.projectId,f.time,f.text.trim()]);const old=grouped.get(key);if(old)old.sources=[...new Set([...old.sources,...f.sources])];else grouped.set(key,{...f,sources:[...f.sources]});}
 return [...grouped.values()].sort((a,b)=>a.day.localeCompare(b.day)||a.time.localeCompare(b.time));
}
export function weekTasks(s:Workspace,week:string){const end=addDays(week,6),within=(d:string)=>!!d&&d>=week&&d<=end;return s.tasks.filter(t=>t.outcomeWeek===week||within(t.focusDay)||within(t.due)||t.sessions.some(x=>within(x.day))||(t.completedAt&&within(dayKey(new Date(t.completedAt)))));}
export function updateReviewParts(s:Workspace,week:string,patch:Partial<ReviewParts>,at=new Date().toISOString()):Workspace{
 const old=s.reviews.find(r=>r.week===week),review={...(old||{id:`weekly-${week}`,week,text:'',createdAt:at}),parts:{...emptyReviewParts,...old?.parts,...patch}};
 return {...s,reviews:old?s.reviews.map(r=>r.id===old.id?review:r):[review,...s.reviews]};
}
export function captureEntry(s:Workspace,day:string,id:string,text:string,project:string,at=new Date().toISOString()):Workspace{
 const old=s.logs.find(l=>l.id===id);if(old&&(!old.capture||old.day!==day))throw new Error('记录已经变化，请重新打开');
 if(project&&!['P1','P2','P3','P4','P5','P6','life'].includes(project))throw new Error('项目无效');
 const entry:Log={...(old||{id,day,evidence:'',createdAt:at,kind:'note'}),capture:true,unclassified:!project,projectId:(project||'life') as Log['projectId'],text};
 return {...s,logs:old?s.logs.map(l=>l.id===id?entry:l):[entry,...s.logs]};
}
export function classifyActual(s:Workspace,day:string,keys:string[],patch:Partial<TimeAllocation>):Workspace{
 const week=weekStart(day),p=getPlan(s,week),selected=new Set(keys);
 return putPlan(s,{...p,days:p.days.map(d=>d.day!==day?d:{...d,hours:d.hours.map(h=>selected.has(`h:${h.hour}`)?{...h,actualAllocation:{projectId:'',category:'',...h.actualAllocation,...patch}}:h),blocks:d.blocks.map(b=>b.field==='actual'&&selected.has(`b:${b.id}`)?{...b,allocation:{projectId:'',category:'',...b.allocation,...patch}}:b)})});
}
export function reviewMarkdown(s:Workspace,week:string){
 const r=s.reviews.find(r=>r.week===week),p={...emptyReviewParts,...r?.parts},plan=s.plans.find(p=>p.week===week),facts=weekFacts(s,week),name=(id:string)=>s.projects.find(p=>p.id===id)?.name||(id==='life'?'生活与精力':'未分类');
 return `# 周回顾｜${week} — ${addDays(week,6)}\n\n> 以下只汇集已记录的信息；未记录不等于未完成。无准确用时的记录不计作小时统计。\n\n## 本周原定重点\n${plan?.focus||'未填写'}\n${(plan?.outcomes||[]).filter(o=>o.deliverable).map(o=>`- ${name(o.projectId)}：${o.deliverable}；${o.done?'已确认完成':'结果待核对'}${o.result?'；结果：'+o.result:''}`).join('\n')}\n\n## 一、事实\n${Array.from({length:7},(_,i)=>{const d=addDays(week,i),items=facts.filter(f=>f.day===d);return `### ${d}\n${items.length?items.map(f=>`- 〔${f.kind==='plan'?'计划，非实际':f.kind==='change'?'操作记录':f.kind==='reflection'?'小结':'实际记录'}｜${name(f.projectId)}｜${f.sources.join('、')}${f.time?'｜'+f.time:''}〕\n${f.text}`).join('\n'):'这一天还可以补充。'}`;}).join('\n\n')}\n\n## 本周任务核对\n${weekTasks(s,week).map(t=>`- ${t.title}：${taskStatusLabel(t.status)}${t.actual?'；'+t.actual:''}`).join('\n')||'没有已关联本周的任务，不能据此判断本周没有产出。'}\n\n## 二、我的分析\n${p.analysis}\n\n### 离阶段方向近了一点吗\n${p.direction}\n\n## 三、我的感受\n${p.feelings}\n\n## 下周带走什么（待本人确认安排）\n${[p.next1,p.next2,p.next3].filter(Boolean).map(x=>'- '+x).join('\n')}\n${p.supplement?'\n## 补充原文\n'+p.supplement+'\n':''}${r?.text?'\n## 以前保存的周回顾原文\n'+r.text+'\n':''}`;
}
