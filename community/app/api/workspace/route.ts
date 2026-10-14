import { getChatGPTUser } from '../../chatgpt-auth';
import { getDb } from '../../../db';
import { workspaces } from '../../../db/schema';
import { stateSchema, seedState } from '../../../lib/workspace';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const json = (data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
export async function GET() {
 const user=await getChatGPTUser();if(!user)return json({error:'请先登录后使用工作台。'},401);
 try {
  const db=getDb();
  let row=await db.select().from(workspaces).where(eq(workspaces.userId,user.userId)).get();
  if(!row){await db.insert(workspaces).values({userId:user.userId,data:JSON.stringify(seedState()),revision:1,updatedAt:new Date().toISOString()}).onConflictDoNothing();row=await db.select().from(workspaces).where(eq(workspaces.userId,user.userId)).get();}
  if(!row)throw new Error('workspace unavailable');
  return json({state:stateSchema.parse(JSON.parse(row.data)),revision:row.revision,updatedAt:row.updatedAt});
 } catch {return json({error:'暂时无法读取数据库记录，请稍后重试。'},503);}
}
export async function PUT(request:Request) {
 const user=await getChatGPTUser();if(!user)return json({error:'登录已过期，请重新登录。'},401);
 const origin=request.headers.get('origin');
 if(origin!==new URL(request.url).origin || request.headers.get('sec-fetch-site')==='cross-site')return json({error:'不接受此来源的更新。'},403);
 if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({error:'请求格式不正确。'},415);
 if(Number(request.headers.get('content-length')||0)>900000)return json({error:'记录过大，请先导出备份。'},413);
 let data;
 try {const text=await request.text();if(new TextEncoder().encode(text).length>900000)return json({error:'记录过大，请先导出备份。'},413);const raw=JSON.parse(text);if(raw?.state?.schemaVersion!==7)return json({error:'工作台已更新，请刷新页面后再保存，避免丢失项目进展与时间分类记录。'},426);data=z.object({state:stateSchema,revision:z.number().int().positive()}).strict().parse(raw);}
 catch{return json({error:'内容格式不正确或超过保存上限，请检查输入。'},400);}
 try {
  const updatedAt=new Date().toISOString();
  const row=await getDb().update(workspaces).set({data:JSON.stringify(data.state),revision:data.revision+1,updatedAt}).where(and(eq(workspaces.userId,user.userId),eq(workspaces.revision,data.revision))).returning({revision:workspaces.revision}).get();
  if(!row)return json({error:'另一台设备已更新。请先复制未保存内容，再刷新工作台，避免覆盖新进度。'},409);
  return json({revision:row.revision,updatedAt});
 }catch{return json({error:'保存未成功，请保留当前输入并重试。'},503);}
}
