import {fixtureState} from './fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {  stateSchema, withSessions, makeReview, exportMarkdown, type Session } from '../lib/workspace.ts';
import { dailyCapacity, continueTask, getPlan, putPlan, mergeWorkspaceDraft, sessionInHour } from '../lib/planning.ts';
import { draftKey, parseDraft } from '../lib/drafts.ts';
const slot=(id:string,day='2026-10-08',startTime='09:30',endTime='11:00'):Session=>({id,day,startTime,endTime,actual:'',plan:'',released:false});
const fixture=()=>{const s=fixtureState();s.tasks[0]=withSessions(s.tasks[0],[slot('a')]);return putPlan(s,getPlan(s,'2026-10-05'));};
test('v3 timed and untimed tasks migrate without losing original notes/results',()=>{
 const old:any=fixture();old.schemaVersion=3;delete old.tasks[0].sessions;old.tasks[0].actual='旧实际记录';delete old.plans[0].outcomes;for(const d of old.plans[0].days)delete d.capacityMinutes;
 const migrated=stateSchema.parse(old);assert.equal(migrated.schemaVersion,8);assert.equal(migrated.tasks[0].sessions.length,1);assert.equal(migrated.tasks[0].sessions[0].startTime,'09:30');assert.equal(migrated.tasks[0].actual,'旧实际记录');assert.equal(migrated.plans[0].days[0].capacityMinutes,null);assert.deepEqual(stateSchema.parse(migrated),migrated);
});
test('multi-session task overlaps every displayed hour and keeps both sessions in review/export',()=>{
 const s=fixture();s.tasks[0]=withSessions(s.tasks[0],[{...slot('a'),actual:'第一段成果'}, {...slot('b','2026-10-09','14:00','15:00'),actual:'第二段成果'}]);
 assert.ok(sessionInHour(s.tasks[0].sessions[0],'2026-10-08',9));assert.ok(sessionInHour(s.tasks[0].sessions[0],'2026-10-08',10));assert.ok(!sessionInHour(s.tasks[0].sessions[0],'2026-10-08',11));
 for(const text of [makeReview(s,'2026-10-05'),exportMarkdown(s)])for(const term of ['第一段成果','第二段成果','09:30–11:00','14:00–15:00'])assert.ok(text.includes(term));
 s.tasks[0].sessions[1].endTime='13:00';assert.equal(stateSchema.safeParse(s).success,false);
});
test('capacity counts tasks once, detects overlaps and excludes released time',()=>{
 const s=fixture(),d=getPlan(s,'2026-10-05').days[3];d.capacityMinutes=120;d.hours=[{hour:10,plan:'同一小时的补充说明',actual:''},{hour:12,plan:'午餐',actual:''}];
 let c=dailyCapacity(s.tasks,d);assert.equal(c.planned,150);assert.equal(c.noteMinutes,60);assert.equal(c.remaining,-30);
 s.tasks.push({...s.tasks[0],id:'other',sessions:[slot('b','2026-10-08','10:00','11:00')]});c=dailyCapacity(s.tasks,d);assert.equal(c.planned,210);assert.equal(c.overlap,60);
 s.tasks[1].sessions[0].released=true;assert.equal(dailyCapacity(s.tasks,d).planned,150);
 d.capacityMinutes=null;assert.equal(dailyCapacity(s.tasks,d).remaining,null);d.capacityMinutes=0;assert.equal(dailyCapacity(s.tasks,d).remaining,-150);
});
test('incomplete schedules and unscheduled priorities are explicitly counted as unknown',()=>{const s=fixture(),d=getPlan(s,'2026-10-05').days[3];s.tasks[0].sessions[0].endTime='';d.anchorTaskIds=[s.tasks[0].id];assert.equal(dailyCapacity(s.tasks,d).unknown,1);assert.equal(dailyCapacity(s.tasks,d).planned,0);s.tasks[0].sessions=[];assert.equal(dailyCapacity(s.tasks,d).unknown,1);});
test('continuation preserves old actuals, releases reservations and appends a new day',()=>{
 const s=fixture();s.tasks[0].sessions[0].actual='已完成一半';let count=0;const next=continueTask(s,s.tasks[0].id,{mode:'continue',fromDay:'2026-10-08',targetDay:'2026-10-09',startTime:'10:00',endTime:'11:00',note:'补齐数据',children:[]},'2026-10-08T10:00:00Z',()=>`id-${++count}`);
 assert.equal(next.tasks.length,1);assert.equal(next.tasks[0].sessions.length,2);assert.equal(next.tasks[0].sessions[0].actual,'已完成一半');assert.equal(next.tasks[0].sessions[0].released,true);assert.equal(next.tasks[0].sessions[1].released,false);assert.ok(next.logs[0].text.includes('补齐数据'));assert.equal(s.tasks[0].sessions[0].released,false);assert.equal(stateSchema.safeParse(next).success,true);
});
test('split creates linked children; waiting and pause retain follow-up and history',()=>{
 const s=fixture();let n=0;const input={mode:'split' as const,fromDay:'2026-10-08',targetDay:'',startTime:'',endTime:'',note:'先做小步骤',children:['核对收件方','补齐资料']};
 const split=continueTask(s,s.tasks[0].id,input,'2026-10-08T10:00:00Z',()=>`split-${++n}`);assert.equal(split.tasks.length,3);assert.equal(split.tasks[0].status,'paused');assert.equal(split.tasks[1].parentTaskId,s.tasks[0].id);assert.equal(split.tasks[1].sessions.length,0);assert.equal(stateSchema.safeParse(split).success,true);
 const waiting=continueTask(s,s.tasks[0].id,{...input,mode:'waiting',targetDay:'2026-10-10'},'2026-10-08T10:00:00Z',()=>`wait-${++n}`);assert.equal(waiting.tasks[0].followUpDay,'2026-10-10');assert.equal(waiting.tasks[0].status,'waiting');assert.equal(waiting.tasks[0].sessions.length,1);
 const resumed=continueTask(waiting,s.tasks[0].id,{...input,mode:'resume'},'2026-10-08T10:00:00Z',()=>`resume-${++n}`);assert.equal(resumed.tasks[0].status,'todo');assert.equal(resumed.tasks[0].sessions[0].released,true);
});
test('independent cloud changes merge with local drafts without reverting either',()=>{
 const base=fixture(),cloud=structuredClone(base),draft=structuredClone(base);cloud.tasks[0].status='done';cloud.tasks[0].completedAt='2026-10-08T10:00:00Z';cloud.projects[0].summary='云端新进展';draft.plans[0].focus='本机周重点';draft.tasks[0].sessions[0].actual='本机时段成果';
 const r=mergeWorkspaceDraft(base,cloud,draft);assert.deepEqual(r.conflicts,[]);assert.equal(r.state.tasks[0].status,'done');assert.equal(r.state.tasks[0].sessions[0].actual,'本机时段成果');assert.equal(r.state.projects[0].summary,'云端新进展');assert.equal(r.state.plans[0].focus,'本机周重点');
});
test('simultaneous edits to the same field are detected, not silently overwritten',()=>{const base=fixture(),cloud=structuredClone(base),draft=structuredClone(base);cloud.plans[0].focus='云端';draft.plans[0].focus='本机';const r=mergeWorkspaceDraft(base,cloud,draft);assert.deepEqual(r.conflicts,['/plans/2026-10-05/focus']);assert.equal(r.state.plans[0].focus,'本机');});
test('drafts survive JSON reload with outcomes and sessions, and are scoped by account/week',()=>{
 const base=fixture(),draft=structuredClone(base);draft.plans[0].outcomes[4]={projectId:'P5',deliverable:'发送邮件',acceptance:'有发送记录',result:'已发送',done:true};draft.tasks[0].sessions.push(slot('b','2026-10-09'));const envelope={format:1 as const,base,draft,savedAt:'2026-10-08T10:00:00Z'};
 assert.deepEqual(parseDraft(JSON.stringify(envelope)),envelope);assert.notEqual(draftKey('a','2026-10-05'),draftKey('b','2026-10-05'));assert.notEqual(draftKey('a','2026-10-05'),draftKey('a','2026-10-12'));assert.ok(makeReview(draft,'2026-10-05').includes('有发送记录'));
});

test('closing as done retains results and history, clears follow-up and releases only future days',()=>{
 const s=fixture(),at='2026-10-09T12:00:00Z';s.tasks[0]=withSessions({...s.tasks[0],status:'waiting',followUpDay:'2026-10-12',actual:'已经发出邮件'},[{...slot('past'),actual:'准备资料'}, {...slot('today','2026-10-09'),actual:'发送邮件'},slot('future','2026-10-10')]);
 let n=0;const next=continueTask(s,s.tasks[0].id,{mode:'done',fromDay:'2026-10-08',targetDay:'2026-10-15',startTime:'',endTime:'',note:'对方已收到',children:[]},at,()=>`close-${++n}`),t=next.tasks[0];
 assert.equal(t.status,'done');assert.equal(t.completedAt,at);assert.equal(t.followUpDay,'');assert.equal(t.actual,'已经发出邮件');assert.deepEqual(t.sessions.slice(0,2),s.tasks[0].sessions.slice(0,2));assert.equal(t.sessions[2].released,true);assert.equal(s.tasks[0].sessions[2].released,false);assert.equal(t.sessions.length,3);
 assert.ok(next.logs[0].text.includes('对方已收到'));assert.ok(next.logs[0].text.includes('准备资料'));assert.ok(!next.logs[0].text.includes('接续 / 跟进'));assert.equal(stateSchema.safeParse(next).success,true);
 const review=makeReview(next,'2026-10-05');assert.ok(review.split('## 本周完成')[1].split('## 本周进展')[0].includes(t.title));assert.ok(!review.split('## 需要接续')[1].split('## 我的判断')[0].includes(t.title));
 assert.throws(()=>continueTask(next,t.id,{mode:'done',fromDay:'2026-10-09',targetDay:'',startTime:'',endTime:'',note:'',children:[]},at,()=>''),/重新打开/);
});

test('not doing a task preserves its history without counting it as completed or pending',()=>{
 const s=fixture();s.tasks[0].status='paused';s.tasks[0].followUpDay='2026-10-12';s.tasks[0].sessions[0].actual='已做前期调研';s.tasks[0].actual='部分资料';let n=0;
 const next=continueTask(s,s.tasks[0].id,{mode:'cancelled',fromDay:'2026-10-08',targetDay:'',startTime:'',endTime:'',note:'方向调整',children:[]},'2026-10-09T12:00:00Z',()=>`cancel-${++n}`),t=next.tasks[0];
 assert.equal(next.tasks.length,s.tasks.length);assert.equal(t.status,'cancelled');assert.equal(t.completedAt,'');assert.equal(t.followUpDay,'');assert.equal(t.actual,'部分资料');assert.deepEqual(t.sessions,s.tasks[0].sessions);assert.ok(next.logs[0].text.includes('方向调整'));assert.ok(next.logs[0].text.includes('已做前期调研'));assert.equal(stateSchema.safeParse(next).success,true);
 const review=makeReview(next,'2026-10-05');assert.ok(!review.split('## 本周完成')[1].split('## 本周进展')[0].includes(t.title));assert.ok(!review.split('## 需要接续')[1].split('## 我的判断')[0].includes(t.title));assert.ok(exportMarkdown(next).includes('已做前期调研'));
});
