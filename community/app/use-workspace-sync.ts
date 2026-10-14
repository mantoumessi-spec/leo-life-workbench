'use client';
import {useEffect,useRef,useState} from 'react';
import {AutoSync,type Remote,type SyncView} from '../lib/auto-sync';
import {SyncJournal,type JournalItem} from '../lib/sync-journal';
import {stateSchema,type Workspace} from '../lib/workspace';
export function useWorkspaceSync(scope:string){
 const [view,setView]=useState<SyncView|null>(null),[loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
 const engine=useRef<AutoSync|null>(null),journal=useRef<SyncJournal|null>(null),mounted=useRef(true),generation=useRef(0);
 async function read():Promise<Remote>{const r=await fetch('/api/workspace',{cache:'no-store',signal:AbortSignal.timeout(15000)}),p=await r.json() as Remote & {error?:string};if(!r.ok)throw new Error(p.error||'无法读取云端');return {...p,state:stateSchema.parse(p.state)};}
 async function load(){
  if(engine.current){await engine.current.refresh();return;}
  const request=++generation.current;setLoading(true);setLoadError('');
  try{
   const remote=await read();if(!mounted.current||request!==generation.current)return;
   let recovered:JournalItem[]=[];
   try{journal.current=new SyncJournal(localStorage,scope,crypto.randomUUID());recovered=journal.current.pending().reverse();}
   catch{setLoadError('无法读取本机草稿，请保持页面打开，确认云端保存成功后再离开。');}
   let restoring=true;
   const sync=new AutoSync(remote,{read,write:async(state,revision)=>{
    const r=await fetch('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,revision}),signal:AbortSignal.timeout(15000)});
    const p=await r.json() as Remote & {error?:string};if(!r.ok)throw Object.assign(new Error(p.error||'保存失败'),{status:r.status});return p;
   },persist:v=>{
    if(!journal.current)throw new Error('本机存储不可用');
    journal.current.persist(v);
    if(!restoring&&!v.dirty){journal.current.acknowledge(recovered);recovered=[];}
   },emit:v=>{if(mounted.current&&request===generation.current)setView(v);}});
   engine.current=sync;
   for(const item of recovered)sync.restore(item.entry.base,item.entry.draft,!!item.entry.blocked);
   restoring=false;
   if(!sync.dirty&&journal.current){try{journal.current.persist(sync.view());journal.current.acknowledge(recovered);recovered=[];}catch{setLoadError('本机历史备份暂时无法保存，云端记录已读取。请勿清理可能仍存有草稿的浏览器数据。');}}
   setView(sync.view());
  }catch(e){if(mounted.current&&request===generation.current)setLoadError(e instanceof Error?e.message:'读取失败');}
  finally{if(mounted.current&&request===generation.current)setLoading(false);}
 }
 useEffect(()=>{
  mounted.current=true;void load();
  const online=()=>void engine.current?.refresh();
  const visibility=()=>{if(document.visibilityState==='hidden')void engine.current?.flush();else void engine.current?.refresh();};
  const pagehide=()=>void engine.current?.flush();
  window.addEventListener('online',online);window.addEventListener('pagehide',pagehide);document.addEventListener('visibilitychange',visibility);
  return()=>{mounted.current=false;generation.current++;engine.current?.stop();engine.current=null;journal.current=null;window.removeEventListener('online',online);window.removeEventListener('pagehide',pagehide);document.removeEventListener('visibilitychange',visibility);};
 },[scope]);
 function queue(state:Workspace,base?:Workspace){return engine.current?.enqueue(state,base)??false;}
 function backups(){try{const seen=new Set<string>();return (journal.current?.list()||[]).filter(item=>{const key=item.entry.status+JSON.stringify(item.entry.draft);if(seen.has(key))return false;seen.add(key);return true;});}catch{return [];}}
 return {view,loading,error:loadError||view?.error||'',load,queue,backups,flush:()=>void engine.current?.flush(),resolve:(local:boolean)=>engine.current?.resolve(local)};
}
