import {z} from 'zod';
export const calendarEventSchema=z.object({id:z.string().min(1).max(500),summary:z.string().max(3000).nullish(),status:z.string().nullish(),isAllDay:z.boolean().optional(),start:z.object({dateTime:z.string().nullish(),date:z.string().nullish()}),end:z.object({dateTime:z.string().nullish(),date:z.string().nullish()})});
export type CalendarEvent={id:string;title:string;start:string;end:string;allDay:boolean};
export function normalizeCalendarEvents(input:unknown[]):CalendarEvent[]{
 const byId=new Map<string,CalendarEvent>();
 for(const raw of input){const e=calendarEventSchema.parse(raw);if(['cancelled','canceled'].includes(e.status||''))continue;
 const allDay=!!e.isAllDay||!e.start.dateTime,start=e.start.dateTime||(e.start.date?e.start.date+'T00:00:00+08:00':''),end=e.end.dateTime||(e.end.date?e.end.date+'T00:00:00+08:00':'');
 if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start))throw new Error('日程时间格式异常');
 byId.set(e.id,{id:e.id,title:e.summary||'未命名日程',start,end,allDay});}
 return [...byId.values()].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.id.localeCompare(b.id));
}
export function calendarInDay(e:CalendarEvent,day:string){const start=Date.parse(day+'T00:00:00+08:00');return Date.parse(e.start)<start+86400000&&Date.parse(e.end)>start;}
export function calendarInHour(e:CalendarEvent,day:string,hour:number,endHour=hour+1){if(e.allDay)return false;const start=Date.parse(day+'T00:00:00+08:00');return Date.parse(e.start)<start+endHour*3600000&&Date.parse(e.end)>start+hour*3600000;}
export function calendarTime(e:CalendarEvent){if(e.allDay)return '全天';const f=(s:string)=>new Date(s).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false});return f(e.start)+'–'+f(e.end);}
