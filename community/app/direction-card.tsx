'use client';
import {useState} from 'react';
import {Compass} from 'lucide-react';
import {getPlan,putPlan} from '../lib/planning';
import {weekStart,type Workspace} from '../lib/workspace';
export default function DirectionCard({data,today,save,onEdit}:{data:Workspace;today:string;save:(s:Workspace,message?:string)=>Promise<boolean>;onEdit:()=>void}){
 const p=getPlan(data,weekStart(today)),[error,setError]=useState('');
 function focus(id:typeof data.projects[number]['id'],checked:boolean){const ids=checked?[...(p.focusProjectIds||[]),id]:(p.focusProjectIds||[]).filter(x=>x!==id);if(ids.length>3){setError('先选最重要的三项就好。');return;}setError('');void save(putPlan(data,{...p,focusProjectIds:ids}));}
 return <details className="direction-card"><summary><Compass size={17}/><span>我正在走向哪里<small>{data.northStar}</small></span><span className="direction-count">本周 {(p.focusProjectIds||[]).length} 项重点</span></summary><div className="direction-body"><p>{data.northStar}</p><button className="text-button" onClick={onEdit}>调整阶段方向</button>{p.focus&&<p className="direction-existing">本周已写下的重点：{p.focus}</p>}<p className="help-text">选最多三项关注；已有责任仍保留，不代表其他项目暂停。</p>{data.projects.map(x=><div className="direction-focus" key={x.id}><label className="checkbox-label"><input type="checkbox" checked={(p.focusProjectIds||[]).includes(x.id)} onChange={e=>focus(x.id,e.target.checked)}/>{x.name}</label>{p.focusProjectIds?.includes(x.id)&&<input aria-label={`${x.name} 本周结果`} placeholder="这周希望得到什么具体结果？" maxLength={2000} value={p.outcomes.find(o=>o.projectId===x.id)?.deliverable||''} onChange={e=>void save(putPlan(data,{...p,outcomes:p.outcomes.map(o=>o.projectId===x.id?{...o,deliverable:e.target.value}:o)}))}/>}</div>)}{error&&<p role="alert">{error}</p>}</div></details>;
}
