'use client';
import {useState} from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import {addDays,weekStart,type Workspace} from '../lib/workspace';
import {getPlan} from '../lib/planning';
import LocalNote from './local-note';
export default function DiaryPage({today,data}:{today:string;data:Workspace}){
 const [day,setDay]=useState(today);
 const old=getPlan(data,weekStart(day)).days.find(d=>d.day===day)?.reflection;
 return <div className="diary-page"><div className="planner-toolbar"><div className="week-picker"><button className="icon-button" aria-label="上一篇日记" onClick={()=>setDay(addDays(day,-1))}><ChevronLeft size={18}/></button><input aria-label="日记日期" type="date" value={day} onChange={e=>e.target.value&&setDay(e.target.value)}/><button className="icon-button" aria-label="下一篇日记" onClick={()=>setDay(addDays(day,1))}><ChevronRight size={18}/></button>{day!==today&&<button className="text-button" onClick={()=>setDay(today)}>回到今天</button>}</div></div><LocalNote key={day} kind="daily" day={day}/>{old&&<details className="quiet-details"><summary>迁移前的小结 · 原文保留</summary><p className="legacy-note">{old}</p></details>}</div>;
}
