import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {getD1} from '../db';
import {addDays,weekStart} from './workspace';
import {normalizeCalendarEvents,type CalendarEvent} from './calendar';
const origin=()=>setting('SITE_ORIGIN');
export const callbackUrl=()=>{const url=origin();if(!url.startsWith('https://'))throw new CalendarError('请配置本站 SITE_ORIGIN');return url+'/api/dingtalk/callback';};
export class CalendarError extends Error{constructor(message:string,public status=503){super(message);}}
function setting(name:string){const value=Reflect.get(env,name);return typeof value==='string'?value:'';}
function credentials(){const clientId=setting('DINGTALK_CLIENT_ID'),clientSecret=setting('DINGTALK_CLIENT_SECRET');if(!clientId||!clientSecret)throw new CalendarError('钉钉连接尚未配置完成。');return {clientId,clientSecret};}
export function configured(){return !!setting('DINGTALK_CLIENT_ID')&&!!setting('DINGTALK_CLIENT_SECRET');}
const tokenSchema=z.object({accessToken:z.string().min(1),refreshToken:z.string().min(1),expireIn:z.coerce.number().positive(),corpId:z.string().optional()});
type Token=z.infer<typeof tokenSchema>&{expiresAt:number};
const bytes=(s:string)=>new TextEncoder().encode(s);
const b64=(b:Uint8Array)=>btoa(String.fromCharCode(...b));
const unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function key(){const hash=await crypto.subtle.digest('SHA-256',bytes('leo-calendar-v1:'+credentials().clientSecret));return crypto.subtle.importKey('raw',hash,'AES-GCM',false,['encrypt','decrypt']);}
async function seal(userId:string,t:Token){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(userId)},await key(),bytes(JSON.stringify(t)));return b64(iv)+'.'+b64(new Uint8Array(cipher));}
async function unseal(userId:string,s:string):Promise<Token>{const [iv,cipher]=s.split('.');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:bytes(userId)},await key(),unb64(cipher));return {...tokenSchema.parse(JSON.parse(new TextDecoder().decode(plain))),expiresAt:z.number().parse(JSON.parse(new TextDecoder().decode(plain)).expiresAt)};}
async function request(path:string,options:RequestInit={}){
 const response=await fetch('https://api.dingtalk.com'+path,{...options,redirect:'manual',signal:AbortSignal.timeout(15000)});
 const reader=response.body?.getReader();if(!reader)throw new CalendarError('钉钉暂未返回数据。');let length=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2000000)throw new CalendarError('日程数据较多，暂未更新，请稍后重试。');chunks.push(value);}}finally{await reader.cancel();}
 const all=new Uint8Array(length);let offset=0;for(const part of chunks){all.set(part,offset);offset+=part.length;}
 if(!response.ok){let providerCode='unknown';try{const payload=JSON.parse(new TextDecoder().decode(all));if(typeof payload.code==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(payload.code))providerCode=payload.code;}catch{}console.error(JSON.stringify({event:'dingtalk_request_failed',endpoint:path.split('?')[0],status:response.status,providerCode}));if(response.status===401)throw new CalendarError('钉钉授权已过期，请重新连接。',401);if(response.status===403)throw new CalendarError('钉钉未允许读取日程，请检查个人授权。',403);if(response.status===429)throw new CalendarError('钉钉请求较频繁，请稍后重试。',429);throw new CalendarError('钉钉暂时无法同步，已有记录保留。');}
 return JSON.parse(new TextDecoder().decode(all));
}
async function exchange(body:Record<string,string>):Promise<Token>{const raw=await request('/v1.0/oauth2/userAccessToken',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...credentials(),...body})});const parsed=tokenSchema.safeParse(raw);if(!parsed.success){console.error(JSON.stringify({event:'dingtalk_token_shape',fields:parsed.error.issues.map(i=>i.path.join('.'))}));throw new CalendarError('钉钉授权数据格式不完整。');}const t=parsed.data;return {...t,expiresAt:Date.now()+t.expireIn*1000};}
export async function startCalendarAuth(userId:string){const {clientId}=credentials(),nonce=crypto.randomUUID()+crypto.randomUUID();await getD1().prepare('INSERT INTO calendar_states(user_id,nonce,expires_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET nonce=excluded.nonce,expires_at=excluded.expires_at').bind(userId,nonce,Date.now()+600000).run();const url=new URL('https://login.dingtalk.com/oauth2/auth');url.search=new URLSearchParams({client_id:clientId,redirect_uri:callbackUrl(),response_type:'code',scope:'openid corpid Calendar.Event.Read',prompt:'consent',state:nonce}).toString();return url.toString();}
export async function finishCalendarAuth(userId:string,state:string,code:string){
 if(state.length>200||!state||code.length>2000||!code)throw new CalendarError('授权信息不完整，请重新连接。',400);
 const row=await getD1().prepare('DELETE FROM calendar_states WHERE user_id=? AND nonce=? AND expires_at>? RETURNING user_id').bind(userId,state,Date.now()).first();if(!row)throw new CalendarError('授权链接已过期或已使用，请重新连接。',400);
 const token=await exchange({code,grantType:'authorization_code'});const expected=setting('DINGTALK_CORP_ID');if(expected&&token.corpId!==expected){console.error(JSON.stringify({event:'dingtalk_org_mismatch',corpIdPresent:!!token.corpId}));throw new CalendarError('请选择当前应用所属组织账号重新授权。',403);}
 const at=new Date().toISOString();await getD1().batch([
 getD1().prepare('INSERT INTO calendar_connections(user_id,encrypted_token,connected_at,lock_until) VALUES(?,?,?,0) ON CONFLICT(user_id) DO UPDATE SET encrypted_token=excluded.encrypted_token,connected_at=excluded.connected_at,lock_until=0').bind(userId,await seal(userId,token),at),
 getD1().prepare('DELETE FROM calendar_snapshots WHERE user_id=?').bind(userId)
 ]);
}
export function validWeek(value:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||weekStart(value)!==value)throw new CalendarError('周日期无效。',400);return value;}
export async function readCalendar(userId:string,week:string){validWeek(week);const db=getD1();const [connection,snapshot]=await Promise.all([db.prepare('SELECT connected_at FROM calendar_connections WHERE user_id=?').bind(userId).first(),db.prepare('SELECT data,updated_at FROM calendar_snapshots WHERE key=? AND user_id=?').bind(userId+'|'+week,userId).first<{data:string;updated_at:string}>()]);return {configured:configured(),connected:!!connection,events:snapshot?JSON.parse(snapshot.data) as CalendarEvent[]:[],updatedAt:snapshot?.updated_at||'',week};}
export async function syncCalendar(userId:string,week:string){
 validWeek(week);const db=getD1(),lock=Date.now()+120000;
 const connection=await db.prepare('UPDATE calendar_connections SET lock_until=? WHERE user_id=? AND lock_until<? RETURNING encrypted_token,connected_at').bind(lock,userId,Date.now()).first<{encrypted_token:string;connected_at:string}>();
 if(!connection){const exists=await db.prepare('SELECT user_id FROM calendar_connections WHERE user_id=?').bind(userId).first();throw new CalendarError(exists?'正在同步，请稍后刷新。':'请先连接你的钉钉日历。',exists?409:401);}
 try{
 const cached=await readCalendar(userId,week);if(cached.updatedAt&&Date.now()-Date.parse(cached.updatedAt)<60000)return cached;
 let token=await unseal(userId,connection.encrypted_token);
 if(token.expiresAt<Date.now()+120000){token=await exchange({refreshToken:token.refreshToken,grantType:'refresh_token'});const saved=await db.prepare('UPDATE calendar_connections SET encrypted_token=? WHERE user_id=? AND lock_until=? AND connected_at=? RETURNING user_id').bind(await seal(userId,token),userId,lock,connection.connected_at).first();if(!saved)throw new CalendarError('连接已变更，请刷新。',409);}
 const collected:unknown[]=[];let nextToken='';const seen=new Set<string>();
 for(let page=0;page<20;page++){
 if(Date.now()>lock-25000)throw new CalendarError('日程读取超时，上次记录保留，请稍后重试。');
 const query=new URLSearchParams({timeMin:new Date(week+'T00:00:00+08:00').toISOString(),timeMax:new Date(addDays(week,7)+'T00:00:00+08:00').toISOString(),maxResults:'100',maxAttendees:'0'});if(nextToken)query.set('nextToken',nextToken);
 const result=z.object({events:z.array(z.unknown()),nextToken:z.string().nullish()}).parse(await request('/v1.0/calendar/me/calendars/primary/eventsview?'+query,{headers:{'x-acs-dingtalk-access-token':token.accessToken}}));collected.push(...result.events);nextToken=result.nextToken||'';if(!nextToken)break;if(seen.has(nextToken)||page===19)throw new CalendarError('日程未完整读取，保留上次记录，请稍后重试。');seen.add(nextToken);
 }
 const events=normalizeCalendarEvents(collected),at=new Date().toISOString();
 const saved=await db.prepare('INSERT INTO calendar_snapshots(key,user_id,week,data,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM calendar_connections WHERE user_id=? AND lock_until=? AND connected_at=?) ON CONFLICT(key) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at RETURNING key').bind(userId+'|'+week,userId,week,JSON.stringify(events),at,userId,lock,connection.connected_at).first();if(!saved)throw new CalendarError('连接已变更，本次同步未保存。',409);
 return {configured:true,connected:true,events,updatedAt:at,week};
 }finally{await db.prepare('UPDATE calendar_connections SET lock_until=0 WHERE user_id=? AND lock_until=?').bind(userId,lock).run();}
}
export async function disconnectCalendar(userId:string){await getD1().batch([getD1().prepare('DELETE FROM calendar_connections WHERE user_id=?').bind(userId),getD1().prepare('DELETE FROM calendar_states WHERE user_id=?').bind(userId)]);}
export function calendarFailure(e:unknown){return {error:e instanceof CalendarError?e.message:'同步暂未完成，已有记录保留。',status:e instanceof CalendarError?e.status:503};}
