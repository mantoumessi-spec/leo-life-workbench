import {fixtureState} from './fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {stateSchema,makeReview,exportMarkdown} from '../lib/workspace.ts';
import {getPlan,putPlan} from '../lib/planning.ts';
import {applyProjectUpdate,editProjectEntry,projectAttention,projectHistory} from '../lib/project-progress.ts';
import {blankReview,reviewContentSchema,proposal,applyPatches} from '../lib/ai-review.ts';
const day='2026-10-09',at='2026-10-09T12:00:00Z';
function fixture(){const s=fixtureState(),p=getPlan(s,'2026-10-05');p.focusProjectIds=['P1','P5'];return putPlan(s,p);}
test('migrating old data does not invent focus choices, dates, or progress',()=>{const old:any=fixtureState();old.schemaVersion=6;const n=stateSchema.parse(old);assert.equal(n.schemaVersion,7);assert.deepEqual(n.projects,old.projects);assert.equal(projectAttention(n,day).pending.length,0);assert.deepEqual(n.logs,[]);});
test('focus and due commitments are checked; paused/waiting and future check dates wait',()=>{
 const s=fixture();s.projects[0].status='等待反馈';s.projects[0].attentionDay='2026-10-12';assert.deepEqual(projectAttention(s,day).pending.map(x=>x.project.id),['P5']);
 s.projects[0].attentionDay=day;assert.deepEqual(projectAttention(s,day).pending.map(x=>x.project.id),['P1','P5']);
 s.projects[1].due=day;assert.ok(projectAttention(s,day).pending.some(x=>x.project.id==='P2'));
 s.projects[0].status='已完成';assert.ok(!projectAttention(s,day).pending.some(x=>x.project.id==='P1'));
 s.plans[0].focusProjectIds=['P1','P2','P3','P4'];assert.equal(stateSchema.safeParse(s).success,false);
});
test('existing actuals satisfy daily check without declaring project complete or progress',()=>{const s=fixture(),d=s.plans[0].days.find(d=>d.day===day)!;d.hours=[{hour:15,plan:'',actual:'核对样品方案，尚未完成',actualAllocation:{projectId:'P1',category:'consumption'}}];const a=projectAttention(s,day);assert.ok(!a.pending.some(x=>x.project.id==='P1'));assert.equal(a.recorded[0].record?.label,'已有实际记录');assert.equal(s.projects[0].status,'进行中');assert.equal(s.logs.length,0);});
test('typing updates one shared progress entry; no tasks, deadlines or project completion invented',()=>{
 const s=fixture(),u={projectId:'P5' as const,kind:'progress' as const,text:'草稿已完成，尚未发送'};const n=applyProjectUpdate(s,u,day,'entry',at);const updated=applyProjectUpdate(n,{...u,text:'补齐草稿，尚未发送',next:'核对收件方',attentionDay:'2026-10-12'},day,'entry',at);
 assert.equal(updated.logs.length,1);assert.equal(projectHistory(updated,'P5')[0].text,'补齐草稿，尚未发送');assert.equal(updated.projects[4].next,'核对收件方');assert.equal(updated.projects[4].attentionDay,'2026-10-12');assert.deepEqual(updated.tasks,s.tasks);assert.equal(updated.projects[4].status,s.projects[4].status);assert.equal(s.logs.length,0);assert.ok(makeReview(updated,'2026-10-05').includes('核对收件方'));assert.ok(exportMarkdown(updated).includes('2026-10-12'));
});
test('not planned and later count as responses only today, not progress or automatic deferral',()=>{for(const kind of ['not_planned','later'] as const){const s=fixture(),n=applyProjectUpdate(s,{projectId:'P5',kind,text:'今天先放一放'},day,'entry',at);assert.ok(!projectAttention(n,day).pending.some(x=>x.project.id==='P5'));assert.ok(projectAttention(n,'2026-10-10').pending.some(x=>x.project.id==='P5'));assert.deepEqual(n.projects,s.projects);assert.deepEqual(n.tasks,s.tasks);}});
test('repeated blockers invite a review; prior progress resets the count and dates stay unchanged',()=>{let s=fixture();for(const [i,date] of ['2026-10-07','2026-10-08'].entries())s=applyProjectUpdate(s,{projectId:'P5',kind:'blocked',text:'下一步太大'},date,'block'+i,at);assert.equal(projectAttention(s,day).pending.find(x=>x.project.id==='P5')?.adjustments,2);s=applyProjectUpdate(s,{projectId:'P5',kind:'progress',text:'拆出一个动作'},day,'progress',at);assert.equal(projectAttention(s,'2026-10-10').pending.find(x=>x.project.id==='P5')?.adjustments,0);assert.equal(s.projects[4].attentionDay,undefined);});
test('historical notes preserve current next step and history is ordered by event date',()=>{const s=applyProjectUpdate(fixture(),{projectId:'P5',kind:'progress',text:'新进展',next:'新下一步'},day,'new',at);assert.throws(()=>applyProjectUpdate(s,{projectId:'P5',kind:'progress',text:'历史',next:'旧下一步'},'2026-10-08','old',at),/更晚/);const n=applyProjectUpdate(s,{projectId:'P5',kind:'progress',text:'历史'},'2026-10-08','old',at);assert.equal(projectHistory(n,'P5')[0].text,'新进展');assert.equal(n.projects[4].next,'新下一步');});
test('oral draft project changes require apply and safely undo without changing unrelated fields',()=>{
 const s=fixture(),c=reviewContentSchema.parse({...blankReview(day,'邮件草稿完成，下一步核对联系人，12号再看'),projectUpdates:[{projectId:'P5',kind:'progress',text:'邮件草稿完成',next:'核对联系人',attentionDay:'2026-10-12'}]});const p=proposal(s,c,'draft',at);assert.equal(s.logs.length,0);assert.equal(p.patches.length,2);
 const n=JSON.parse(JSON.stringify(applyPatches(s,p)));assert.equal(n.projects[4].next,'核对联系人');assert.equal(n.logs.length,1);assert.deepEqual(n.tasks,s.tasks);assert.equal(proposal(n,c,'duplicate',at).patches.length,0);
 n.projects[4].purpose='另一次修改';const back=applyPatches(n,JSON.parse(JSON.stringify(p)),true);assert.equal(back.projects[4].next,s.projects[4].next);assert.equal(back.projects[4].attentionDay,undefined);assert.equal(back.projects[4].purpose,'另一次修改');assert.equal(back.logs.length,0);
});
test('oral project edits and undo refuse newer next steps or modified progress entries',()=>{
 const s=fixture(),c=reviewContentSchema.parse({...blankReview(day,'有进展'),projectUpdates:[{projectId:'P5',kind:'progress',text:'新进展',next:'下一步'}]}),p=proposal(s,c,'a',at),n=applyPatches(s,p);
 const concurrent=structuredClone(s);concurrent.projects[4].next='手机上的修改';assert.throws(()=>applyPatches(concurrent,p),/已有更新/);n.logs[0].text='后来补充';assert.throws(()=>applyPatches(n,p,true),/已有更新/);
 assert.equal(reviewContentSchema.safeParse({...c,projectUpdates:[...c.projectUpdates,...c.projectUpdates]}).success,false);
});

test('separate same-day entries accumulate while autosaving one entry keeps its position',()=>{
 let s=fixture();
 s=applyProjectUpdate(s,{projectId:'P5',kind:'progress',text:'第一笔'},day,'first','2026-10-09T01:00:00Z');
 s=applyProjectUpdate(s,{projectId:'P5',kind:'progress',text:'第二笔'},day,'second','2026-10-09T07:00:00Z');
 s=applyProjectUpdate(s,{projectId:'P5',kind:'progress',text:'第二笔补充'},day,'second','2026-10-09T08:00:00Z');
 assert.deepEqual(projectHistory(s,'P5').map(l=>l.text),['第二笔补充','第一笔']);
 assert.equal(s.logs[0].createdAt,'2026-10-09T07:00:00Z');
 const n=applyProjectUpdate(s,{projectId:'P5',kind:'progress',text:'明天第三笔'},'2026-10-10','third','2026-10-10T01:00:00Z');
 assert.deepEqual(projectHistory(n,'P5').map(l=>l.id),['third','second','first']);
});
test('correcting a historical entry preserves dates, evidence, other entries and current project settings',()=>{
 let s=applyProjectUpdate(fixture(),{projectId:'P5',kind:'blocked',text:'昨天卡点',next:'旧下一步',attentionDay:day},'2026-10-08','old',at);
 s=applyProjectUpdate(s,{projectId:'P5',kind:'progress',text:'今天已推进',next:'新的下一步',attentionDay:'2026-10-12'},day,'new',at);
 s.logs.find(l=>l.id==='old')!.evidence='原有证据';
 const n=editProjectEntry(s,'P5','old','修正昨天卡点','waiting');
 assert.equal(n.logs.length,2);assert.deepEqual(n.projects,s.projects);assert.deepEqual(n.tasks,s.tasks);
 const l=n.logs.find(l=>l.id==='old')!;assert.equal(l.day,'2026-10-08');assert.equal(l.createdAt,at);assert.equal(l.evidence,'原有证据');assert.equal(l.checkIn?.next,'旧下一步');assert.equal(l.checkIn?.kind,'waiting');
 assert.equal(projectHistory(n,'P5')[0].id,'new');assert.throws(()=>editProjectEntry(n,'P1','old','误改','progress'),/已变化/);assert.throws(()=>editProjectEntry(n,'P5','old','  ','progress'));
});
test('legacy notes can be corrected without replacing evidence or making them check-ins',()=>{
 const s=fixture();s.logs.push({id:'legacy',projectId:'P5',kind:'note',day,text:'原始文字',evidence:'附件说明',createdAt:at});
 const n=editProjectEntry(s,'P5','legacy','修正的原始文字','progress');
 assert.deepEqual(n.logs[0],{...s.logs[0],text:'修正的原始文字'});assert.deepEqual(n.projects,s.projects);
});
test('oral progress appends to the same timeline and undo keeps previous manual entries',()=>{
 const s=applyProjectUpdate(fixture(),{projectId:'P5',kind:'progress',text:'上午记录'},day,'manual',at);
 const c=reviewContentSchema.parse({...blankReview(day,'晚上有新的反馈'),projectUpdates:[{projectId:'P5',kind:'waiting',text:'晚上收到新的反馈'}]});
 const p=proposal(s,c,'oral','2026-10-09T14:00:00Z'),n=applyPatches(s,p);
 assert.deepEqual(projectHistory(n,'P5').map(l=>l.text),['晚上收到新的反馈','上午记录']);assert.deepEqual(applyPatches(n,p,true),s);
});
