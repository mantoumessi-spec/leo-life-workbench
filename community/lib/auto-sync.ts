import {stateSchema,type Workspace} from './workspace.ts';
import {mergeWorkspaceDraft} from './planning.ts';
export type Remote={state:Workspace;revision:number;updatedAt:string};
export type SyncStatus='saved'|'pending'|'saving'|'offline'|'conflict'|'invalid';
export type SyncView={state:Workspace;base:Workspace;status:SyncStatus;error:string;savedAt:string;revision:number;dirty:boolean};
type SyncIO={read:()=>Promise<Remote>;write:(state:Workspace,revision:number)=>Promise<{revision:number;updatedAt:string}>;persist:(v:SyncView)=>void;emit:(v:SyncView)=>void};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export class AutoSync {
 base:Workspace;state:Workspace;revision:number;savedAt:string;status:SyncStatus='saved';error='';
 private timer:ReturnType<typeof setTimeout>|undefined;private running=false;private stopped=false;private retry=0;
 private io:SyncIO;private delay:number;
 constructor(remote:Remote,io:SyncIO,delay=1000){this.io=io;this.delay=delay;this.base=remote.state;this.state=remote.state;this.revision=remote.revision;this.savedAt=remote.updatedAt;}

 get dirty(){return !equal(this.base,this.state);}
 view():SyncView{return {state:this.state,base:this.base,status:this.status,error:this.error,savedAt:this.savedAt,revision:this.revision,dirty:this.dirty};}
 private publish(){const v=this.view();try{this.io.persist(v);}catch{this.error='本机草稿保存失败，请保持页面打开，等待云端保存。';}this.io.emit(this.view());}
 private schedule(ms=this.delay){clearTimeout(this.timer);if(!this.stopped&&this.dirty&&!['conflict','invalid'].includes(this.status))this.timer=setTimeout(()=>void this.flush(),ms);}
 enqueue(candidate:Workspace,base=this.state){
  if(this.stopped)return false;
  const parsed=stateSchema.safeParse(candidate);if(!parsed.success){this.error=parsed.error.issues[0]?.message||'内容格式不正确';this.status='invalid';this.publish();return false;}
  const merged=mergeWorkspaceDraft(base,this.state,parsed.data);this.state=merged.state;
  if(merged.conflicts.length||this.status==='conflict'){this.status='conflict';this.error='云端和本机修改了同一处内容，已保留输入，请选择要保留的版本。';}else {this.status=this.dirty?'pending':'saved';this.error='';}
  this.publish();this.schedule();return true;
 }
 restore(base:Workspace,draft:Workspace,blocked=false){const m=mergeWorkspaceDraft(base,this.state,draft);const parsed=stateSchema.safeParse(m.state);this.state=m.state;if(blocked||this.status==='conflict'||m.conflicts.length||!parsed.success){this.status='conflict';this.error='发现尚未同步的本机内容，与云端有冲突。请核对后选择。';}else this.status=this.dirty?'pending':'saved';this.publish();this.schedule();}
 async refresh(){
  if(this.stopped||this.running)return;
  if(this.dirty){await this.flush();return;}
  this.running=true;
  try{
   const remote=await this.io.read();if(this.stopped||remote.revision<this.revision)return;
   const m=mergeWorkspaceDraft(this.base,remote.state,this.state);
   this.base=remote.state;this.revision=remote.revision;this.savedAt=remote.updatedAt;this.state=m.state;
   if(m.conflicts.length||!stateSchema.safeParse(m.state).success||this.status==='conflict'){this.status='conflict';this.error='其他窗口有更新，已保留输入，请核对冲突内容。';}
   else{this.status=this.dirty?'pending':'saved';this.error='';}
  }catch{this.error='暂时无法核对云端最新记录，当前显示上次读取的内容。';}
  finally{this.running=false;if(!this.stopped){this.publish();this.schedule();}}
 }
 async flush(){
  clearTimeout(this.timer);if(this.stopped||this.running||!this.dirty||['conflict','invalid'].includes(this.status))return;
  this.running=true;this.status='saving';this.error='';this.publish();const sent=this.state;
  try {const result=await this.io.write(sent,this.revision);this.base=sent;this.revision=result.revision;this.savedAt=result.updatedAt;this.retry=0;this.status=this.dirty?'pending':'saved';this.error='';}
  catch(e){
   const code=(e as {status?:number})?.status;
   if(code===409||!code||code>=500){
    try{const remote=await this.io.read(),m=mergeWorkspaceDraft(equal(remote.state,sent)?sent:this.base,remote.state,this.state);this.base=remote.state;this.revision=remote.revision;this.savedAt=remote.updatedAt;this.state=m.state;
     if(m.conflicts.length||!stateSchema.safeParse(m.state).success){this.status='conflict';this.error='云端和本机修改了同一处内容，已保留两边内容，请核对后选择。';}
     else {this.status=this.dirty?'offline':'saved';this.error=this.dirty?'暂未同步云端，输入已留在本机，将自动重试。':'';}
    }catch{this.status='offline';this.error='网络暂不可用，输入已留在本机，恢复后自动重试。';}
   }else{this.status='invalid';this.error=e instanceof Error?e.message:'暂时不能保存，请检查内容或登录状态。';}
  }finally{this.running=false;if(!this.stopped){this.publish();this.schedule(this.status==='offline'?Math.min(30000,2000*2**this.retry++):this.delay);}}
 }
 resolve(useLocal:boolean){if(this.running)return;if(!useLocal)this.state=this.base;const parsed=stateSchema.safeParse(this.state);if(!parsed.success){this.error='本机内容仍有冲突：'+parsed.error.issues[0]?.message;this.status='conflict';this.publish();return;}this.state=parsed.data;this.status=this.dirty?'pending':'saved';this.error='';this.publish();this.schedule(0);}
 stop(){this.stopped=true;clearTimeout(this.timer);}
}
