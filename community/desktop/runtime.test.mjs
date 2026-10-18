import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import runtime from '../dist/desktop/app/routes.cjs';
import {openLocalDatabase} from './database.mjs';
const migrations=resolve(import.meta.dirname,'../drizzle');
const origin='https://workbench.local';
async function call(path='/api/workspace',method='GET',body,source=origin){const r=await runtime.route(new Request(origin+path,{method,headers:{Origin:source,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}));return {status:r.status,data:await r.json()};}

test('desktop starts empty, persists across restarts, preserves revision/restore and review transactions',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'leo-desktop-test-'));
 try{
  await runtime.initialize(dir,migrations);const initial=await call();assert.equal(initial.status,200);
  const s=initial.data.state;assert.equal(s.displayName,'');assert.equal(s.northStar,'');for(const k of ['tasks','plans','logs','reviews'])assert.deepEqual(s[k],[]);assert.deepEqual(s.projects.map(p=>p.name),['项目 1','项目 2','项目 3','项目 4','项目 5','项目 6']);
  const state={...s,displayName:'虚构测试',northStar:'测试重启保存'};
  assert.equal((await call('/api/workspace','PUT',{state,revision:1})).status,200);
  assert.equal((await call('/api/workspace','PUT',{state,revision:1})).status,409);
  assert.equal((await call('/api/workspace','PUT',{state,revision:2},'https://invalid.example')).status,403);
  runtime.close();await runtime.initialize(dir,migrations);assert.deepEqual((await call()).data.state,state);
  const content={day:'2026-10-14',rawText:'虚构测试日记',times:[],projectUpdates:[],reflection:'虚构测试小结',unplaced:'',nextActions:[]};
  const created=await call('/api/ai-review','POST',{action:'create',requestId:crypto.randomUUID(),content});assert.equal(created.status,200);const r=created.data.review;
  const committed=await call('/api/ai-review','POST',{action:'commit',id:r.id,version:r.version,confirmed:true});assert.equal(committed.status,200);
  const duplicate=await call('/api/ai-review','POST',{action:'commit',id:r.id,version:r.version,confirmed:true});assert.equal(duplicate.status,200);
  assert.equal((await call('/api/ai-review','POST',{action:'undo',id:r.id,version:committed.data.review.version,confirmed:true})).status,200);
  const latest=(await call()).data;assert.equal((await call('/api/workspace','PUT',{state:JSON.parse(JSON.stringify(s)),revision:latest.revision})).status,200);assert.deepEqual((await call()).data.state,s);
  assert.equal((await runtime.route(new Request(origin+'/mcp'))).status,404);
  assert.equal((await runtime.route(new Request(origin+'/api/dingtalk'))).status,404);
 }finally{runtime.close();rmSync(dir,{recursive:true,force:true});}
});
test('SQLite backup is readable, stable per day, and a failed batch fully rolls back',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'leo-db-test-'));const db=openLocalDatabase(dir,migrations);
 try{
  db.migrate();await db.prepare('INSERT INTO workspaces VALUES (?,?,?,?)').bind('test','{}',1,'today').run();
  await assert.rejects(db.batch([db.prepare('UPDATE workspaces SET revision=2'),db.prepare('INSERT INTO missing VALUES (1)')]));
  assert.equal((await db.prepare('SELECT revision FROM workspaces').first()).revision,1);
  const path=await db.snapshot();assert.equal(await db.snapshot(),path);assert.equal(readdirSync(join(dir,'backups')).length,1);
  const saved=new DatabaseSync(path,{readOnly:true});assert.equal(saved.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(saved.prepare('SELECT revision FROM workspaces').get().revision,1);saved.close();
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('Markdown autosave, Obsidian conflict detection, restart linking and complete backup',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'community-notes-'));
 try{
  await runtime.initialize(dir,migrations);
  const endpoint='/api/notes?kind=daily&day=2026-10-18';
  const empty=await call(endpoint);assert.equal(empty.data.exists,false);
  assert.equal((await call(endpoint,'PUT',{text:'Fictional journal\nSecond line',version:empty.data.version})).status,200);
  const saved=await call(endpoint);assert.equal(readFileSync(saved.data.path,'utf8'),'Fictional journal\nSecond line');
  const {writeFileSync,existsSync}=await import('node:fs');writeFileSync(saved.data.path,'Changed externally');
  const conflict=await call(endpoint,'PUT',{text:'Must not replace',version:saved.data.version});assert.equal(conflict.status,409);assert.equal(conflict.data.current.text,'Changed externally');
  assert.equal((await call('/api/note-link','POST',{kind:'weekly',day:'2026-10-12',path:'daily/2026-10-18.md'})).status,200);
  assert.equal((await call('/api/note-link','POST',{kind:'weekly',day:'2026-10-12',path:'daily/../../private.md'})).status,400);
  runtime.close();await runtime.initialize(dir,migrations);assert.equal((await call('/api/notes?kind=weekly&day=2026-10-12')).data.text,'Changed externally');
  const full=await call('/api/full-backup','POST',{});assert.equal(full.status,200);
  const {gunzipSync}=await import('node:zlib');const payload=JSON.parse(gunzipSync(readFileSync(full.data.file)));assert.equal(payload.notes['daily/2026-10-18.md'],'Changed externally');assert.equal(payload.settings.links['weekly:2026-10-12'],'daily/2026-10-18.md');
  const restore=join(dir,'recovered.sqlite');writeFileSync(restore,Buffer.from(payload.database,'base64'));const db=new DatabaseSync(restore);assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');db.close();
 }finally{runtime.close();rmSync(dir,{recursive:true,force:true});}
});
