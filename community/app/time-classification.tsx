'use client';
import {useState} from 'react';
import {categoryLabels,emptyAllocation,timeCategories,type TimeAllocation,type Workspace} from '../lib/workspace';
import {durationLabel,timeTotals} from '../lib/time-allocation';
import type {DayPlan} from '../lib/planning';
type ClassificationProps={value?:TimeAllocation;projects:Workspace['projects'];label:string;onChange:(a:TimeAllocation)=>void};
export function ClassificationSelect({value,projects,label,onChange,dimension}:{dimension:'projectId'|'category'}&ClassificationProps){
 const a=value||emptyAllocation,isProject=dimension==='projectId';
 return <select className="classification-select" aria-label={`${label} ${isProject?'所属项目':'时间类型'}`} title={isProject?projects.find(p=>p.id===a.projectId)?.name|| (a.projectId==='life'?'生活与精力':'项目未分类'):a.category?categoryLabels[a.category]:'类型未分类'} value={a[dimension]} onChange={e=>onChange({...a,[dimension]:e.target.value} as TimeAllocation)}><option value="">{isProject?'项目未分类':'未分类'}</option>{isProject?<>{projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}<option value="life">生活与精力</option></>:timeCategories.map(c=><option value={c} key={c}>{categoryLabels[c]}</option>)}</select>;
}
export function ClassificationFields(props:ClassificationProps){return <div className="time-classification"><ClassificationSelect {...props} dimension="projectId"/><ClassificationSelect {...props} dimension="category"/></div>;}
export function TimeSummary({days,selectedDay,data}:{days:DayPlan[];selectedDay:string;data:Workspace}){
 const [scope,setScope]=useState<'day'|'week'>('day'),[field,setField]=useState<'actual'|'plan'>('actual');
 const totals=timeTotals(scope==='day'?days.filter(d=>d.day===selectedDay):days,data.tasks,field);
 function bars(items:[string,string][],values:Record<string,number>){return <div className="time-bars">{items.filter(([id])=>values[id]).map(([id,name])=><div className={`time-bar-row category-${id}`} key={id}><div><span>{name}</span><strong>{durationLabel(values[id])}</strong></div><div className="time-bar-track"><i style={{width:`${values[id]/totals.total*100}%`}}/></div></div>)}</div>;}
 return <section className="panel time-summary"><div className="section-head"><div><span className="planner-kicker">TIME ALLOCATION</span><h2>时间花在哪里</h2></div><strong className="time-total">{totals.total?durationLabel(totals.total):'尚无记录'}</strong></div><div className="time-summary-options"><div className="view-switch" aria-label="统计范围"><button aria-pressed={scope==='day'} onClick={()=>setScope('day')}>当天</button><button aria-pressed={scope==='week'} onClick={()=>setScope('week')}>本周</button></div><div className="view-switch" aria-label="统计口径"><button aria-pressed={field==='actual'} onClick={()=>setField('actual')}>实际投入</button><button aria-pressed={field==='plan'} onClick={()=>setField('plan')}>计划时间</button></div><span>{scope==='day'?selectedDay:`${days[0]?.day} — ${days.at(-1)?.day}`}</span></div>
 {totals.total?<div className="time-summary-columns"><div><h3>按项目</h3>{bars([...data.projects.map(p=>[p.id,p.name] as [string,string]),['life','生活与精力'],['unclassified','项目未分类']],totals.projects)}</div><div><h3>按时间类型</h3>{bars([...timeCategories.map(c=>[c,categoryLabels[c]] as [string,string]),['unclassified','类型未分类']],totals.categories)}</div></div>:<p className="empty-inline">{field==='actual'?'在实际格填写内容或选择分类后，这里会显示已记录的投入。':'填写计划或安排任务时段后，这里会显示已安排时间。'}</p>}
 <p className="help-text">仅统计 08:00—22:00。填写或分类代表占用该格整段时间，合并格按起止时长计算；同一时段只计一次。实际投入不从计划推算，任务进展文字请配合实际格的分类确认用时。未记录的时间不代表没有投入。</p></section>;
}
