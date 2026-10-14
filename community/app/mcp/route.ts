import {z} from 'zod';
import {getChatGPTUser} from '../chatgpt-auth';
import {dayKey,weekStart} from '../../lib/workspace';
import {projectAttention,projectHistory} from '../../lib/project-progress';
import {getPlan} from '../../lib/planning';
import {ReviewError,reviewContentSchema,reviewPreview} from '../../lib/ai-review';
import {readWorkspace,listReviews,getReview,createReview,updateReview,commitReview,touchConnection} from '../../lib/review-store';
import {reviewTools,mcpInstructions} from '../../lib/review-mcp';
export const dynamic='force-dynamic';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const argsId=z.object({id:z.string().uuid()}).strict(),argsConfirm=z.object({id:z.string().uuid(),version:z.number().int().positive(),confirmed:z.literal(true)}).strict();
export async function POST(request:Request){
 const origin=request.headers.get('origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'来源不被允许'},403);
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({error:'请求格式不正确'},415);
 let rpc:any;try{const raw=await request.text();if(new TextEncoder().encode(raw).length>150000)return json({error:'请求过大'},413);rpc=JSON.parse(raw);}catch{return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Invalid JSON'}},400);}
 if(!rpc||rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string')return json({jsonrpc:'2.0',id:rpc?.id??null,error:{code:-32600,message:'Invalid request'}},400);
 const result=(value:unknown)=>json({jsonrpc:'2.0',id:rpc.id??null,result:value});
 if(rpc.method==='initialize')return result({protocolVersion:['2024-11-05','2025-03-26','2025-06-18','2025-11-25'].includes(rpc.params?.protocolVersion)?rpc.params.protocolVersion:'2025-06-18',capabilities:{tools:{listChanged:false}},serverInfo:{name:'leo-life-workbench',version:'1.0.0'},instructions:mcpInstructions});
 if(rpc.method==='notifications/initialized'||rpc.method==='notifications/cancelled')return new Response(null,{status:202});
 if(rpc.method==='ping')return result({});
 if(rpc.method==='tools/list')return result({tools:reviewTools});
 if(rpc.method!=='tools/call')return json({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32601,message:'Method not found'}});
 const user=await getChatGPTUser();if(!user)return json({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32001,message:'请连接并登录你自己的工作台账号。'}},401);
 try{
  const name=rpc.params?.name,args=rpc.params?.arguments??{};let value:unknown;
  if(name==='read_day_context'){
   const a=z.object({day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict().parse(args);const current=await readWorkspace(user.userId);value={today:dayKey(),timezone:'Asia/Shanghai',requestedDay:a.day,revision:current.revision,projects:current.state.projects.map(p=>({...p,recentUpdates:projectHistory(current.state,p.id,a.day).slice(0,5)})),attention:{focusProjectIds:getPlan(current.state,weekStart(a.day)).focusProjectIds||[],pending:projectAttention(current.state,a.day).pending.map(x=>({projectId:x.project.id,reason:x.reason,adjustments:x.adjustments})),alreadyRecorded:projectAttention(current.state,a.day).recorded.map(x=>({projectId:x.project.id,record:x.record}))},day:getPlan(current.state,weekStart(a.day)).days.find(d=>d.day===a.day),tasks:current.state.tasks.filter(t=>t.sessions.some(s=>s.day===a.day)||!['done','cancelled'].includes(t.status)).map(t=>({id:t.id,title:t.title,projectId:t.projectId,status:t.status,due:t.due,sessions:t.sessions.filter(s=>s.day===a.day)})),instructions:mcpInstructions};
  }else if(name==='list_review_drafts'){z.object({}).strict().parse(args);value=(await listReviews(user.userId)).reviews.map(r=>({id:r.id,version:r.version,status:r.status,day:r.payload.content.day,updatedAt:r.updatedAt}));}
  else if(name==='get_review_draft'){value=await getReview(user.userId,argsId.parse(args).id);}
  else if(name==='prepare_review_draft'){const a=z.object({requestId:z.string().min(1).max(100),content:reviewContentSchema}).strict().parse(args);value=await createReview(user.userId,a.requestId,a.content);}
  else if(name==='update_review_draft'){const a=z.object({id:z.string().uuid(),version:z.number().int().positive(),content:reviewContentSchema}).strict().parse(args);value=await updateReview(user.userId,a.id,a.version,a.content);}
  else if(name==='confirm_review_draft'||name==='undo_review_write'){const a=argsConfirm.parse(args);value=await commitReview(user.userId,a.id,a.version,name==='undo_review_write');}
  else return json({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32602,message:'Unknown tool'}});
  await touchConnection(user.userId);
  const r=value as any;if(r?.payload)value={...r,preview:reviewPreview(r.payload),reviewUrl:`${new URL(request.url).origin}/?review=${encodeURIComponent(r.id)}#ai`,notice:r.status==='pending'?'已保存草稿，尚未写入正式记录。请展示预览并等待用户确认。':r.status==='applied'?'已写入工作台，可在复盘页查看并撤回。':'本次写入已撤回。'};
  return result({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:Array.isArray(value)?{items:value}:value,isError:false});
 }catch(e){const message=e instanceof ReviewError?e.message:e instanceof z.ZodError?e.issues[0]?.message||'参数不正确':'暂时无法完成，请保留草稿并重试。';return result({content:[{type:'text',text:message}],isError:true});}
}
export async function GET(){return new Response(null,{status:405,headers:{Allow:'POST'}});}
