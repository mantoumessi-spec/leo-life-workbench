import {parseDraft,type DraftEnvelope} from './drafts.ts';
import type {SyncView} from './auto-sync.ts';
type StorageLike=Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
export type JournalEntry=DraftEnvelope & {status:'pending'|'saved'|'archived';blocked?:boolean;revision?:number};
export type JournalItem={key:string;raw:string;entry:JournalEntry};
// Each running page owns a different slot. One page must never clear another page's edits.
export class SyncJournal {
 private storage:StorageLike;
 readonly prefix:string;readonly legacyKey:string;readonly key:string;
 constructor(storage:StorageLike,scope:string,writer:string){this.storage=storage;this.prefix=`leo-sync-journal-v2:${encodeURIComponent(scope)}:`;this.legacyKey=`leo-auto-sync-v1:${encodeURIComponent(scope)}`;this.key=this.prefix+'draft:'+writer;}
 list():JournalItem[]{
  const items:JournalItem[]=[];
  for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(!key||(!key.startsWith(this.prefix)&&key!==this.legacyKey))continue;const raw=this.storage.getItem(key);if(!raw)continue;
   try{const parsed=JSON.parse(raw),draft=parseDraft(raw);if(key!==this.legacyKey&&!['pending','saved','archived'].includes(parsed.status))continue;items.push({key,raw,entry:{...draft,status:key===this.legacyKey?'pending':parsed.status,blocked:!!parsed.blocked,revision:parsed.revision}});}catch{/* Retain unreadable records; never clear them as a successful save. */}
  }
  return items.sort((a,b)=>b.entry.savedAt.localeCompare(a.entry.savedAt)||(b.entry.revision||0)-(a.entry.revision||0));
 }
 pending(){return this.list().filter(v=>v.entry.status==='pending');}
 persist(v:SyncView){
  // Prune only old confirmed/archived snapshots. Unsynced drafts are never evicted.
  const old=this.list().filter(x=>x.entry.status!=='pending'&&x.key!==this.key);
  for(const item of old.slice(11))this.storage.removeItem(item.key);
  const entry:JournalEntry={format:1,savedAt:v.dirty?new Date().toISOString():v.savedAt,base:v.base,draft:v.state,status:v.dirty?'pending':'saved',blocked:v.status==='conflict',revision:v.revision};
  this.storage.setItem(this.key,JSON.stringify(entry));
  if(!v.dirty)this.storage.setItem(this.prefix+'saved:'+v.revision,JSON.stringify(entry));
 }
 acknowledge(items:JournalItem[]){
  for(const item of items){
   if(item.key===this.key||this.storage.getItem(item.key)!==item.raw)continue;
   // Archive a recovered draft instead of destroying it, including a rejected conflict version.
   const archived=JSON.stringify({...item.entry,status:'archived'});
   if(item.key===this.legacyKey){this.storage.setItem(this.prefix+'legacy:'+item.entry.savedAt,archived);if(this.storage.getItem(item.key)===item.raw)this.storage.removeItem(item.key);}
   else this.storage.setItem(item.key,archived);
  }
 }
}
