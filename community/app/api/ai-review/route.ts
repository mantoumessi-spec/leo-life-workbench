import {z} from 'zod';
import {getChatGPTUser} from '../../chatgpt-auth';
import {reviewContentSchema,ReviewError} from '../../../lib/ai-review';
import {createReview,listReviews,updateReview,commitReview,dismissReview} from '../../../lib/review-store';
export const dynamic='force-dynamic';
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const command=z.discriminatedUnion('action',[
 z.object({action:z.literal('create'),requestId:z.string().min(1).max(100),content:reviewContentSchema}).strict(),
 z.object({action:z.literal('update'),id:z.string().uuid(),version:z.number().int().positive(),content:reviewContentSchema}).strict(),
 z.object({action:z.enum(['commit','undo']),id:z.string().uuid(),version:z.number().int().positive(),confirmed:z.literal(true)}).strict(),
 z.object({action:z.literal('dismiss'),id:z.string().uuid(),version:z.number().int().positive()}).strict()
]);
export async function GET(){const user=await getChatGPTUser();if(!user)return json({error:'请先登录工作台'},401);try{return json(await listReviews(user.userId));}catch{return json({error:'复盘草稿暂时无法加载，请重试'},503);}}
export async function POST(request:Request){const user=await getChatGPTUser();if(!user)return json({error:'请先登录工作台'},401);if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'不接受此来源的更新'},403);if(!(request.headers.get('content-type')||'').startsWith('application/json'))return json({error:'请求格式不正确'},415);
 try{const text=await request.text();if(new TextEncoder().encode(text).length>150000)return json({error:'口述内容过长，请分次整理'},413);const c=command.parse(JSON.parse(text));let review;
 if(c.action==='create')review=await createReview(user.userId,c.requestId,c.content);
 else if(c.action==='update')review=await updateReview(user.userId,c.id,c.version,c.content);
 else if(c.action==='dismiss')review=await dismissReview(user.userId,c.id,c.version);
 else review=await commitReview(user.userId,c.id,c.version,c.action==='undo');
 return json({review});
 }catch(e){if(e instanceof ReviewError)return json({error:e.message},e.status);if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'请检查草稿格式'},400);if(e instanceof SyntaxError)return json({error:'请提供有效草稿'},400);return json({error:'本次操作暂未确认成功，请保留草稿并重试。重复确认不会重复写入。'},503);}
}
