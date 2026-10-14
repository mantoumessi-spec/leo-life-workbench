import {hourLabel, timeBlockSchema, allocationLabel, emptyAllocation, hasAllocation, type TimeBlock, type TimeAllocation} from './workspace.ts';
import type {DayPlan} from './planning.ts';
export type BlockRange=Pick<TimeBlock,'field'|'start'|'end'>;
export const allocationKey=(field:TimeBlock['field'])=>field==='plan'?'planAllocation':'actualAllocation';
export const hourHasContent=(h:DayPlan['hours'][number])=>!!(h.plan||h.actual||hasAllocation(h.planAllocation)||hasAllocation(h.actualAllocation));
function sourceEntries(day:DayPlan,range:BlockRange,editingId=''){
 timeBlockSchema.parse({...range,id:'validate',text:''});
 const blocks=day.blocks.filter(b=>b.id!==editingId&&b.field===range.field&&b.start<range.end&&b.end>range.start);
 if(blocks.some(b=>b.start<range.start||b.end>range.end))throw new Error('所选范围切到了已有合并格，请包含整个合并格，或先将它拆分。');
 return [...day.hours.filter(h=>h.hour>=range.start&&h.hour<range.end&&(h[range.field]||hasAllocation(h[allocationKey(range.field)]))).map(h=>({start:h.hour,end:h.hour+1,text:h[range.field],allocation:h[allocationKey(range.field)]})),...blocks].sort((a,b)=>a.start-b.start);
}
export function blockSources(day:DayPlan,range:BlockRange,editingId=''){
 return sourceEntries(day,range,editingId).map(x=>`${hourLabel(x.start)}—${hourLabel(x.end)}${allocationLabel(x.allocation)}\n${x.text}`).join('\n\n');
}
export function mergeTimeBlock(day:DayPlan,block:TimeBlock):DayPlan{
 timeBlockSchema.parse(block);
 const sources=sourceEntries(day,block,block.id),originals=blockSources(day,block,block.id);
 const text=[block.text,originals].filter(Boolean).join('\n\n');
 if(text.length>30000)throw new Error('合并内容超过30000字，请缩小合并范围。');
 const classifications=[...new Set(sources.map(s=>JSON.stringify(s.allocation||emptyAllocation)))];
 if(classifications.length>1&&!block.allocation)throw new Error('原时段的分类不同，请选择合并后整段的项目和时间类型；原分类会随原文保留。');
 const inherited:TimeAllocation|undefined=block.allocation||sources.find(s=>s.allocation)?.allocation;
 const merged={...block,text,...(inherited?{allocation:inherited}:{})};
 const affected=day.blocks.filter(b=>b.id===block.id||(b.field===block.field&&b.start>=block.start&&b.end<=block.end));
 return {...day,blocks:[...day.blocks.filter(b=>!affected.includes(b)),merged],hours:day.hours.map(h=>{if(h.hour<block.start||h.hour>=block.end)return h;const next={...h,[block.field]:''};delete next[allocationKey(block.field)];return next;}).filter(hourHasContent)};
}
export function splitTimeBlock(day:DayPlan,id:string):DayPlan{
 const block=day.blocks.find(b=>b.id===id);if(!block)return day;
 const entries=[...day.hours];
 for(let hour=block.start;hour<block.end;hour++){
  const old=entries.find(h=>h.hour===hour)||{hour,plan:'',actual:''};
  const entry={...old,[block.field]:hour===block.start?[old[block.field],block.text].filter(Boolean).join('\n\n'):old[block.field],...((block.text.trim()||block.allocation)?{[allocationKey(block.field)]:block.allocation||{...emptyAllocation}}:{})};
  const index=entries.findIndex(h=>h.hour===hour);if(index<0)entries.push(entry);else entries[index]=entry;
 }
 return {...day,blocks:day.blocks.filter(b=>b.id!==id),hours:entries.filter(hourHasContent).sort((a,b)=>a.hour-b.hour)};
}
