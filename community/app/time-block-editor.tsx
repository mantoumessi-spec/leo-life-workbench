'use client';
import {useState} from 'react';
import {hours,hourLabel,type TimeBlock,type Workspace} from '../lib/workspace';
import {blockSources,mergeTimeBlock,splitTimeBlock} from '../lib/time-blocks';
import {ClassificationFields} from './time-classification';
import type {DayPlan} from '../lib/planning';
export default function TimeBlockEditor({day,initial,busy,onApply,onClose,projects}:{projects:Workspace['projects'];day:DayPlan;initial:TimeBlock;busy:boolean;onApply:(d:DayPlan)=>void;onClose:()=>void}){
 const [block,setBlock]=useState(initial),[error,setError]=useState('');
 const existing=day.blocks.some(b=>b.id===block.id);
 let preview='',rangeError='';try{preview=blockSources(day,block,block.id);}catch(e){rangeError=e instanceof Error?e.message:'请检查时段';}
 function apply(){try{onApply(mergeTimeBlock(day,block));}catch(e){setError(e instanceof Error?e.message:'无法合并');}}
 return <form onSubmit={e=>{e.preventDefault();apply();}}><fieldset className="task-fieldset" disabled={busy}>
 <p className="help-text">{day.day} · 计划和实际可分别合并，任务记录继续保留在对应时段。</p>
 <label>合并哪一栏<select disabled={existing} value={block.field} onChange={e=>setBlock({...block,field:e.target.value as TimeBlock['field']})}><option value="plan">计划</option><option value="actual">实际完成</option></select></label>
 <div className="form-inline"><label>开始时间<select value={block.start} onChange={e=>{const start=Number(e.target.value);setBlock({...block,start,end:Math.max(start+1,block.end)});}}>{hours.map(h=><option key={h} value={h}>{hourLabel(h)}</option>)}</select></label><label>结束时间<select value={block.end} onChange={e=>setBlock({...block,end:Number(e.target.value)})}>{hours.map(h=>h+1).filter(h=>h>block.start).map(h=><option key={h} value={h}>{hourLabel(h)}</option>)}</select></label></div>
 <label>{existing?'整段内容':'这段时间做什么 / 做了什么'}<textarea rows={5} maxLength={30000} value={block.text} onChange={e=>setBlock({...block,text:e.target.value})} placeholder="例如：分析店铺销售不及预期的原因"/></label>
 <label>整段时间的归属</label><ClassificationFields projects={projects} label="合并时段" value={block.allocation} onChange={allocation=>setBlock({...block,allocation})}/><p className="help-text">分类应用于整段时间。原时段分类相同时可沿用；不同则请明确选择，原分类随原文保留。</p>
 {preview&&<div className="merge-preview"><strong>以下原文也会保留在合并格中</strong><pre>{preview}</pre></div>}
 {(rangeError||error)&&<p className="error-banner" role="alert">{rangeError||error}</p>}
 <p className="help-text">确认合并或调整后会自动同步数据库，无需另点保存。{existing?'拆分后，整段文字保留在起始小时，其他小时保留分类与用时标记，仍可继续填写。':''}</p>
 <div className="modal-actions">{existing&&<button type="button" className="text-button" onClick={()=>onApply(splitTimeBlock(day,block.id))}>拆回小时格</button>}<button type="button" className="button secondary" onClick={onClose}>取消</button><button className="button primary" disabled={!!rangeError}>{existing?'确认调整':'确认合并'}</button></div>
 </fieldset></form>;
}
