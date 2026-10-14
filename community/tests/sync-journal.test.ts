import {fixtureState} from './fixtures.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {SyncJournal} from '../lib/sync-journal.ts';

import type {SyncView} from '../lib/auto-sync.ts';
class MemoryStorage {
 data=new Map<string,string>();get length(){return this.data.size;}key(n:number){return [...this.data.keys()][n]??null;}getItem(k:string){return this.data.get(k)??null;}setItem(k:string,v:string){this.data.set(k,v);}removeItem(k:string){this.data.delete(k);}
}
function view(text:string,dirty=true,revision=1):SyncView{const base=fixtureState(),state={...base,northStar:text};return {base:dirty?base:state,state,dirty,revision,status:dirty?'pending':'saved',error:'',savedAt:'2026-10-12T01:00:00Z'};}
test('saving in a second tab cannot erase the first tab offline draft',()=>{
 const storage=new MemoryStorage(),a=new SyncJournal(storage,'leo','a'),b=new SyncJournal(storage,'leo','b');a.persist(view('上午输入'));b.persist(view('另一个窗口',false));
 assert.equal(a.pending().length,1);assert.equal(a.pending()[0].entry.draft.northStar,'上午输入');
 // Reopening after every page closes still discovers the first page's pending content.
 assert.equal(new SyncJournal(storage,'leo','reopened').pending()[0].entry.draft.northStar,'上午输入');
});
test('recovery acknowledgement never clears a concurrently updated draft',()=>{
 const storage=new MemoryStorage(),a=new SyncJournal(storage,'leo','a'),b=new SyncJournal(storage,'leo','b');a.persist(view('first'));const pending=b.pending();a.persist(view('newer'));b.acknowledge(pending);assert.equal(b.pending()[0].entry.draft.northStar,'newer');
 b.acknowledge(b.pending());assert.equal(b.pending().length,0);assert.equal(b.list()[0].entry.draft.northStar,'newer');assert.equal(b.list()[0].entry.status,'archived');
});
test('successful saves keep downloadable snapshots, bounded without evicting unsynced content',()=>{
 const storage=new MemoryStorage(),a=new SyncJournal(storage,'leo','a'),b=new SyncJournal(storage,'leo','b');a.persist(view('offline'));
 for(let i=2;i<35;i++)b.persist(view('saved '+i,false,i));
 assert.ok(b.list().length<=15);assert.equal(b.pending()[0].entry.draft.northStar,'offline');assert.ok(b.list().some(x=>x.entry.draft.northStar==='saved 33'));assert.ok(b.list().some(x=>x.entry.draft.northStar==='saved 34'));
});
test('legacy draft is archived after recovery and users are isolated',()=>{
 const storage=new MemoryStorage(),a=new SyncJournal(storage,'leo','a');const v=view('legacy');storage.setItem(a.legacyKey,JSON.stringify({format:1,savedAt:new Date().toISOString(),base:v.base,draft:v.state}));
 assert.equal(new SyncJournal(storage,'someone-else','b').pending().length,0);a.acknowledge(a.pending());assert.equal(storage.getItem(a.legacyKey),null);assert.equal(a.list()[0].entry.draft.northStar,'legacy');
});
