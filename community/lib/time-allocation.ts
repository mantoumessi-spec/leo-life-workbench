import {emptyAllocation, hasAllocation, type Task, type TimeAllocation, type TimeBlock} from './workspace.ts';
import {minute, type DayPlan} from './planning.ts';
import {allocationKey} from './time-blocks.ts';
// Each minute is counted at most once. Explicit timetable entries override task plans.
// A task's progress note does not establish its actual duration.
export function timeTotals(days:DayPlan[],tasks:Task[],field:TimeBlock['field']){
 const projects:Record<string,number>={},categories:Record<string,number>={};let total=0;
 for(const d of days){
  const slots:Array<TimeAllocation|undefined>=Array(14*60);
  if(field==='plan')for(const t of tasks.filter(t=>t.status!=='cancelled'))for(const s of t.sessions.filter(s=>s.day===d.day&&!s.released&&s.startTime&&s.endTime)){
   for(let m=Math.max(480,minute(s.startTime));m<Math.min(1320,minute(s.endTime));m++){
    const old=slots[m-480];slots[m-480]=old&&old.projectId!==t.projectId?{projectId:'',category:''}:{projectId:t.projectId,category:''};
   }
  }
  for(const h of d.hours)if(h[field].trim()||hasAllocation(h[allocationKey(field)]))for(let m=h.hour*60;m<(h.hour+1)*60;m++)slots[m-480]=h[allocationKey(field)]||emptyAllocation;
  for(const b of d.blocks.filter(b=>b.field===field&&(b.text.trim()||hasAllocation(b.allocation))))for(let m=b.start*60;m<b.end*60;m++)slots[m-480]=b.allocation||emptyAllocation;
  for(const a of slots)if(a){total++;projects[a.projectId||'unclassified']=(projects[a.projectId||'unclassified']||0)+1;categories[a.category||'unclassified']=(categories[a.category||'unclassified']||0)+1;}
 }
 return {total,projects,categories};
}
export function durationLabel(minutes:number){const h=Math.floor(minutes/60),m=minutes%60;return `${h?h+' 小时':''}${h&&m?' ':''}${m?m+' 分钟':''}`||'0 小时';}
