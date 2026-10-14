import {fixtureState} from './fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {stateSchema,exportMarkdown,makeReview,withSessions,type TimeAllocation} from '../lib/workspace.ts';
import {getPlan,putPlan,dailyCapacity} from '../lib/planning.ts';
import {mergeTimeBlock,splitTimeBlock} from '../lib/time-blocks.ts';
import {timeTotals} from '../lib/time-allocation.ts';
const allocation:TimeAllocation={projectId:'P1',category:'investment'};
const day=()=>getPlan(fixtureState(),'2026-10-05').days[3];
test('actual totals classify merged duration independently from planned time, blank time is absent',()=>{
 const d=day();d.blocks=[{id:'a',field:'actual',start:9,end:12,text:'分析销售',allocation},{id:'p',field:'plan',start:9,end:13,text:'计划',allocation:{projectId:'P2',category:'debt'}}];
 d.hours=[{hour:14,plan:'',actual:'休息',actualAllocation:{projectId:'life',category:'consumption'}},{hour:15,plan:'',actual:'旧记录'},{hour:16,plan:'',actual:''}];
 assert.deepEqual(timeTotals([d],[],'actual'),{total:300,projects:{P1:180,life:60,unclassified:60},categories:{investment:180,consumption:60,unclassified:60}});
 assert.equal(timeTotals([d],[],'plan').total,240);
});
test('split and remerge preserve duration and classification, with original text kept once',()=>{
 let d=mergeTimeBlock(day(),{id:'b',field:'actual',start:9,end:12,text:'分析销售',allocation});d=splitTimeBlock(d,'b');assert.equal(d.hours.filter(h=>h.actual).length,1);
 assert.equal(timeTotals([d],[],'actual').total,180);assert.equal(timeTotals([d],[],'actual').projects.P1,180);
 d=mergeTimeBlock(d,{id:'b2',field:'actual',start:9,end:12,text:''});assert.deepEqual(d.blocks[0].allocation,allocation);assert.equal(timeTotals([d],[],'actual').total,180);
 const unclassified=splitTimeBlock(mergeTimeBlock(day(),{id:'u',field:'plan',start:9,end:12,text:'原记录'}),'u');assert.equal(timeTotals([unclassified],[],'plan').total,180);assert.equal(dailyCapacity([],unclassified).planned,180);
});
test('mixed classifications require an explicit choice and preserve prior labels in merged text',()=>{
 const d=day();d.hours=[{hour:9,plan:'',actual:'A',actualAllocation:allocation},{hour:10,plan:'',actual:'B',actualAllocation:{projectId:'P2',category:'debt'}}];
 const block={id:'b',field:'actual' as const,start:9,end:11,text:''};assert.throws(()=>mergeTimeBlock(d,block),/分类不同/);
 const merged=mergeTimeBlock(d,{...block,allocation});assert.match(merged.blocks[0].text,/P2 \/ 负债/);assert.equal(timeTotals([merged],[],'actual').categories.investment,120);
});
test('task plans use exact minutes and do not become actual time from progress notes; explicit entries count once',()=>{
 const s=fixtureState(),d=day();const t=withSessions(s.tasks[0],[{id:'s',day:d.day,startTime:'09:30',endTime:'11:15',actual:'已研究',plan:'',released:false}]);
 assert.equal(timeTotals([d],[t],'plan').total,105);assert.equal(timeTotals([d],[t],'actual').total,0);
 d.blocks=[{id:'b',field:'plan',start:9,end:12,text:'整段',allocation}];assert.deepEqual(timeTotals([d],[t],'plan').projects,{P1:180});
 const overlap={...t,id:'second',projectId:'P2' as const};d.blocks=[];assert.deepEqual(timeTotals([d],[t,overlap],'plan').projects,{unclassified:105});
});
test('v5 migration keeps historical text unclassified and new classifications roundtrip/export without loss',()=>{
 const old:any=fixtureState();old.schemaVersion=5;old.plans=[{...getPlan(old,'2026-10-05'),days:[{...day(),hours:[{hour:8,plan:'旧计划',actual:'旧实际'}]}]}];
 const state=stateSchema.parse(old);assert.equal(state.schemaVersion,7);assert.equal(state.plans[0].days[0].hours[0].actualAllocation,undefined);
 const d=mergeTimeBlock(day(),{id:'b',field:'actual',start:9,end:12,text:'分析销售',allocation});const plan=getPlan(state,'2026-10-05');plan.days[3]=d;const next=putPlan(state,plan);
 assert.deepEqual(stateSchema.parse(JSON.parse(JSON.stringify(next))),next);for(const text of [exportMarkdown(next),makeReview(next,plan.week)])assert.match(text,/P1 \/ 投资/);
 const invalid:any=structuredClone(next);invalid.plans[0].days[3].blocks[0].allocation.category='unknown';assert.equal(stateSchema.safeParse(invalid).success,false);
});
test('covered hour classification cannot hide underneath merged block',()=>{
 const state=fixtureState(),plan=getPlan(state,'2026-10-05'),d=plan.days[3];d.blocks=[{id:'b',field:'actual',start:9,end:12,text:'记录'}];d.hours=[{hour:10,plan:'',actual:'',actualAllocation:allocation}];assert.equal(stateSchema.safeParse(putPlan(state,plan)).success,false);
});
