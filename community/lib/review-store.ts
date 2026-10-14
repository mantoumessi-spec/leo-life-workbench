import {and,desc,eq} from 'drizzle-orm';
import {getDb,getD1} from '../db';
import {aiReviews,aiConnections,workspaces} from '../db/schema';
import {seedState,stateSchema,type Workspace} from './workspace';
import {reviewContentSchema,applyPatches,proposal,ReviewError,same,type ReviewContent,type ReviewPayload,type ReviewRecord} from './ai-review';
const now=()=>new Date().toISOString();
const record=(r:typeof aiReviews.$inferSelect):ReviewRecord=>({id:r.id,version:r.version,status:r.status as ReviewRecord['status'],payload:{...JSON.parse(r.payload),content:reviewContentSchema.parse(JSON.parse(r.payload).content)},createdAt:r.createdAt,updatedAt:r.updatedAt});
export async function readWorkspace(userId:string){const db=getDb();let row=await db.select().from(workspaces).where(eq(workspaces.userId,userId)).get();if(!row){await db.insert(workspaces).values({userId,data:JSON.stringify(seedState()),revision:1,updatedAt:now()}).onConflictDoNothing();row=await db.select().from(workspaces).where(eq(workspaces.userId,userId)).get();}if(!row)throw new ReviewError('暂时无法读取工作台',503);return {state:stateSchema.parse(JSON.parse(row.data)),revision:row.revision,updatedAt:row.updatedAt};}
export async function listReviews(userId:string){const rows=await getDb().select().from(aiReviews).where(eq(aiReviews.userId,userId)).orderBy(desc(aiReviews.updatedAt)).limit(50);const connection=await getDb().select().from(aiConnections).where(eq(aiConnections.userId,userId)).get();return {reviews:rows.map(record),lastConnectedAt:connection?.lastSeenAt||''};}
export async function touchConnection(userId:string){const at=now();await getDb().insert(aiConnections).values({userId,lastSeenAt:at}).onConflictDoUpdate({target:aiConnections.userId,set:{lastSeenAt:at}});}
export async function getReview(userId:string,id:string){const row=await getDb().select().from(aiReviews).where(and(eq(aiReviews.userId,userId),eq(aiReviews.id,id))).get();if(!row)throw new ReviewError('找不到这份草稿',404);return record(row);}
export async function createReview(userId:string,requestId:string,content:ReviewContent){
 const key=`${userId}|${requestId}`,db=getDb(),existing=await db.select().from(aiReviews).where(eq(aiReviews.key,key)).get();
 if(existing){const r=record(existing);if(!same(reviewContentSchema.parse(r.payload.content),content))throw new ReviewError('这次口述已生成草稿，请使用原草稿编号修改，避免重复创建。',409);return r;}
 const current=await readWorkspace(userId),id=crypto.randomUUID(),at=now(),payload=proposal(current.state,content,id,at);
 await db.insert(aiReviews).values({key,userId,id,requestId,payload:JSON.stringify(payload),version:1,status:'pending',createdAt:at,updatedAt:at}).onConflictDoNothing();
 const saved=await db.select().from(aiReviews).where(eq(aiReviews.key,key)).get();if(!saved)throw new ReviewError('草稿暂未保存，请重试',503);const r=record(saved);if(!same(reviewContentSchema.parse(r.payload.content),content))throw new ReviewError('同一口述正在被修改，请刷新草稿。',409);return r;
}
export async function updateReview(userId:string,id:string,version:number,content:ReviewContent){
 const current=await getReview(userId,id);if(current.status!=='pending')throw new ReviewError('这份草稿已经处理，请新建一份修订草稿。',409);
 if(current.version!==version){if(current.version===version+1&&same(reviewContentSchema.parse(current.payload.content),content))return current;throw new ReviewError('草稿在另一处已有修改。你的输入已保留，请核对云端版本。',409);}
 const remote=await readWorkspace(userId),payload=proposal(remote.state,content,id,current.createdAt,current.payload.originalText);
 const row=await getDb().update(aiReviews).set({payload:JSON.stringify(payload),version:version+1,updatedAt:now()}).where(and(eq(aiReviews.userId,userId),eq(aiReviews.id,id),eq(aiReviews.version,version),eq(aiReviews.status,'pending'))).returning().get();if(!row)throw new ReviewError('草稿已更新，请刷新后核对',409);return record(row);
}
export async function commitReview(userId:string,id:string,version:number,reverse=false){
 const draft=await getReview(userId,id),target=reverse?'undone':'applied',from=reverse?'applied':'pending';
 if(draft.status===target&&draft.version===version+1)return draft;
 if(draft.status!==from||draft.version!==version)throw new ReviewError('草稿状态或版本已变化，请重新查看后确认。',409);
 if(!draft.payload.patches.length)throw new ReviewError('草稿没有可写入的变化。请补充时间记录、小结，或选择待办。');
 const current=await readWorkspace(userId),next=applyPatches(current.state,draft.payload,reverse),at=now(),db=getD1();
 // Both statements are one D1 transaction. The second only runs when the workspace CAS succeeded.
 await db.batch([
  db.prepare("UPDATE workspaces SET data=?,revision=revision+1,updated_at=? WHERE user_id=? AND revision=? AND EXISTS(SELECT 1 FROM ai_reviews WHERE user_id=? AND id=? AND version=? AND status=?)").bind(JSON.stringify(next),at,userId,current.revision,userId,id,version,from),
  db.prepare("UPDATE ai_reviews SET status=?,version=version+1,updated_at=? WHERE user_id=? AND id=? AND version=? AND status=? AND changes()=1").bind(target,at,userId,id,version,from)
 ]);
 const result=await getReview(userId,id);if(result.status!==target||result.version!==version+1)throw new ReviewError('写入时记录有变化，请重新核对草稿后确认。',409);return result;
}
export async function dismissReview(userId:string,id:string,version:number){const r=await getDb().update(aiReviews).set({status:'dismissed',version:version+1,updatedAt:now()}).where(and(eq(aiReviews.userId,userId),eq(aiReviews.id,id),eq(aiReviews.version,version),eq(aiReviews.status,'pending'))).returning().get();if(!r)throw new ReviewError('草稿状态已变化，请刷新',409);return record(r);}
