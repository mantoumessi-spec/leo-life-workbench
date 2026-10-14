// Deliberately fixed to loopback: never execute these writes against a hosted site.
import assert from 'node:assert/strict';
const base='http://127.0.0.1:5173';
async function client(name){const r=await fetch(`${base}/signin-with-chatgpt?test_user=${name}&return_to=/`,{redirect:'manual'});assert.equal(r.status,302);const cookie=r.headers.get('set-cookie').split(';')[0];return async(path='/api/workspace',method='GET',body,extra={})=>{const r=await fetch(base+path,{method,headers:{cookie,Origin:base,'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});const raw=await r.text();let data;try{data=JSON.parse(raw)}catch{data={error:raw}}return {status:r.status,data};};}
const a=await client('alice'),b=await client('bob');
for(const path of ['/api/workspace','/api/ai-review']){const r=await fetch(base+path,{headers:{'oai-authenticated-user-id':'local_alice','oai-authenticated-user-email':'alice@sites.test'}});assert.equal(r.status,401,`forged identity: ${path}`);}
const unauthorizedMcp=await fetch(base+'/mcp',{method:'POST',headers:{'Content-Type':'application/json','oai-authenticated-user-id':'local_alice','oai-authenticated-user-email':'alice@sites.test'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'get_workbench_context',arguments:{day:'2026-10-14'}}})});assert.equal(unauthorizedMcp.status,401);
const originalA=(await a()).data,originalB=(await b()).data;
try{
 const state={...originalA.state,displayName:'Alice 测试',northStar:'Alice 独立内容'};
 const saved=await a('/api/workspace','PUT',{state,revision:originalA.revision});assert.equal(saved.status,200);
 assert.deepEqual((await b()).data,originalB,'B must remain untouched by A save');
 assert.equal((await a()).data.state.northStar,state.northStar);
 assert.equal((await a('/api/workspace','PUT',{state,revision:originalA.revision})).status,409,'stale revision');
 assert.equal((await a('/api/workspace','PUT',{state,revision:saved.data.revision},{Origin:'https://invalid.example'})).status,403);
 const content={day:'2026-10-14',rawText:'本地账号隔离测试',times:[],projectUpdates:[],reflection:'Alice 的小结',unplaced:'',nextActions:[]};
 const ar=await a('/api/ai-review','POST',{action:'create',requestId:crypto.randomUUID(),content});assert.equal(ar.status,200);const draft=ar.data.review;
 assert.ok(!(await b('/api/ai-review')).data.reviews.some(r=>r.id===draft.id));
 for(const action of ['update','commit','undo','dismiss']){const r=await b('/api/ai-review','POST',{action,id:draft.id,version:draft.version,...(action==='update'?{content}:action==='dismiss'?{}:{confirmed:true})});assert.equal(r.status,action==='dismiss'?409:404,`cross-user ${action}`);}
 const applied=await a('/api/ai-review','POST',{action:'commit',id:draft.id,version:draft.version,confirmed:true});assert.equal(applied.status,200);
 assert.deepEqual((await b()).data,originalB,'B must remain untouched by A review commit');
 assert.equal((await a('/api/ai-review','POST',{action:'undo',id:draft.id,version:applied.data.review.version,confirmed:true})).status,200);
 for(const c of [a,b]){assert.equal((await c('/api/dingtalk?week=2026-10-12')).status,503);assert.equal((await c('/api/dingtalk?action=connect','POST')).status,503);}
 // JSON export round-trip and restore through the actual revision-checked API.
 const backup=JSON.parse(JSON.stringify({format:'leo-workbench',state:originalA.state}));
 const latest=(await a()).data;assert.equal((await a('/api/workspace','PUT',{state:backup.state,revision:latest.revision})).status,200);
 assert.deepEqual((await a()).data.state,originalA.state);
 console.log('PASS: two local identities, forged/anonymous rejection, isolated records, draft listing/update/commit/undo/dismiss, stale revision, origin checks, disabled calendars and backup restore. Hosted real-account verification remains pending.');
}finally{for(const [c,original] of [[a,originalA],[b,originalB]]){const latest=(await c()).data;await c('/api/workspace','PUT',{state:original.state,revision:latest.revision});}}
