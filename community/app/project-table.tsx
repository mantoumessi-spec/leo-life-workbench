'use client';
import {Fragment,useState} from 'react';
import {ChevronDown,ChevronRight,Plus,Pencil} from 'lucide-react';
import type {Project,Workspace} from '../lib/workspace';
import {projectHistory} from '../lib/project-progress';
import {ProjectProgressInfo} from './project-progress';
import './project-table.css';

type Props={data:Workspace;onProgress:(projectId:string,logId?:string)=>void;onEdit:(project:Project)=>void;onAct:(projectId:Project['id'])=>void};
export default function ProjectTable({data,onProgress,onEdit,onAct}:Props){
 const [expanded,setExpanded]=useState<string|null>(null);
 return <section className="project-sheet" aria-label="项目总览">
  <div className="project-sheet-heading"><div><h2>项目总览 <small>{data.projects.length} 个项目</small></h2><p>一行看清一个项目，展开就能回看一路走来的记录。</p></div><span>左右滑动，查看完整信息</span></div>
  <div className="project-sheet-scroll" role="region" aria-label="项目表格，可左右滚动" tabIndex={0}>
   <table className="project-sheet-table"><caption className="project-sheet-sr">项目、状态、目标、最新进展、下一步、关注日期、截止日期与操作。展开项目可查看完整背景和进展历史。</caption>
    <thead><tr><th scope="col">项目</th><th scope="col">状态</th><th scope="col">目标 / 意义</th><th scope="col">最新进展</th><th scope="col">下一步</th><th scope="col">下次关注</th><th scope="col">截止日期</th><th scope="col">操作</th></tr></thead>
    <tbody>{data.projects.map(p=>{
     const history=projectHistory(data,p.id),latest=history[0],open=expanded===p.id;
     return <Fragment key={p.id}><tr className={open?'project-sheet-selected':''}>
      <th scope="row"><button className="project-sheet-name" aria-expanded={open} aria-controls={`project-detail-${p.id}`} onClick={()=>setExpanded(open?null:p.id)}>{open?<ChevronDown size={16}/>:<ChevronRight size={16}/>}<span><small>{p.id}</small><strong>{p.name}</strong></span></button></th>
      <td><span className={`project-sheet-status ${p.status==='进行中'?'is-active':''}`}>{p.status}</span></td>
      <td><p className="project-sheet-preview">{p.purpose||'暂未填写'}</p></td>
      <td>{latest?<><time dateTime={latest.day}>{latest.day}</time><p className="project-sheet-preview">{latest.text}</p><button className="text-button" onClick={()=>setExpanded(open?null:p.id)}>查看记录 · {history.length} 条</button></>:<span className="project-sheet-empty">还没有进展记录</span>}</td>
      <td><p className="project-sheet-preview">{p.next||'留一个具体的下一步'}</p></td>
      <td>{p.attentionDay?<time dateTime={p.attentionDay}>{p.attentionDay}</time>:<span className="project-sheet-empty">尚未约定</span>}</td>
      <td>{p.due?<time dateTime={p.due}>{p.due}</time>:<span className="project-sheet-empty">未设置</span>}</td>
      <td><div className="project-sheet-actions"><button className="button secondary small" aria-label={`${p.name}：记进展`} onClick={()=>onProgress(p.id)}><Plus size={13}/>记进展</button><button className="text-button" aria-label={`${p.name}：编辑项目`} onClick={()=>onEdit(p)}><Pencil size={13}/>编辑</button><button className="text-button" aria-label={`${p.name}：添加行动`} onClick={()=>onAct(p.id)}>添加行动</button></div></td>
     </tr>{open&&<tr className="project-sheet-detail" id={`project-detail-${p.id}`}><td colSpan={8}><div className="project-sheet-detail-inner"><div className="project-sheet-background"><h3>{p.name}</h3><h4>目标 / 意义</h4><p>{p.purpose||'暂未填写'}</p><h4>项目背景</h4><p>{p.summary||'暂未填写'}</p><h4>下一步</h4><p>{p.next||'暂未填写'}</p></div><ProjectProgressInfo data={data} project={p} onEdit={logId=>onProgress(p.id,logId)}/></div></td></tr>}</Fragment>;
    })}</tbody>
   </table>
  </div>
 </section>;
}
