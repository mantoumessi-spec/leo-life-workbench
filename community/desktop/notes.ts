import {mkdirSync,readFileSync,writeFileSync,existsSync,realpathSync,readdirSync,lstatSync,renameSync,openSync,closeSync,fsyncSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {getD1} from './db';
let home='',choose:undefined|(()=>Promise<string|null>);
type Settings={dailyDir:string;weeklyDir:string;links:Record<string,string>};
let settings:Settings;
function atomic(file:string,text:string|Buffer){mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp',fd=openSync(temp,'wx',0o600);try{writeFileSync(fd,text);fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,file);}
export function initializeNotes(directory:string,picker?:()=>Promise<string|null>){home=realpathSync(directory);choose=picker;const f=path.join(home,'notes-settings.json');settings=existsSync(f)?JSON.parse(readFileSync(f,'utf8')):{dailyDir:path.join(home,'日记'),weeklyDir:path.join(home,'周记'),links:{}};for(const d of [settings.dailyDir,settings.weeklyDir])mkdirSync(d,{recursive:true});saveSettings();}
function saveSettings(){atomic(path.join(home,'notes-settings.json'),JSON.stringify(settings));}
function dayValid(day:string){const d=new Date(day+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==day)throw new Error('日期无效');}
function directory(kind:string){if(!['daily','weekly'].includes(kind))throw new Error('文档类型无效');return realpathSync(kind==='daily'?settings.dailyDir:settings.weeklyDir);}
function fileFor(id:string){const m=/^(daily|weekly)\/([^/\\]+\.md)$/.exec(id);if(!m||m[2]==='..')throw new Error('文件名无效');const dir=directory(m[1]),file=path.resolve(dir,m[2]);if(!file.startsWith(dir+path.sep)||(existsSync(file)&&lstatSync(file).isSymbolicLink()))throw new Error('文件必须在选定目录内');return file;}
function noteId(kind:string,day:string){directory(kind);dayValid(day);const key=kind+':'+day;if(settings.links[key])return settings.links[key];const end=new Date(day+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+6);return kind+'/'+(kind==='daily'?day:day+'至'+end.toISOString().slice(0,10))+'.md';}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function readNote(kind:string,day:string){const id=noteId(kind,day),file=fileFor(id),exists=existsSync(file),text=exists?readFileSync(file,'utf8'):'';return {text,version:exists?hash(text):'missing',path:file,exists};}
export function writeNote(kind:string,day:string,text:string,version:string){if(typeof text!=='string'||Buffer.byteLength(text)>2000000)throw new Error('正文超出限制');const old=readNote(kind,day);if(old.version!==version)throw Object.assign(new Error('另一窗口或 Obsidian 已修改原文，请合并后再保存。'),{status:409,current:old});if(old.exists)atomic(path.join(home,'backups','notes',`${Date.now()}-${randomUUID()}.json`),JSON.stringify({path:old.path,text:old.text}));if(readNote(kind,day).version!==version)throw Object.assign(new Error('原文件刚有更新，请核对'),{status:409,current:readNote(kind,day)});atomic(old.path,text);return readNote(kind,day);}
export function noteFiles(){return ['daily','weekly'].flatMap(k=>readdirSync(directory(k)).filter(f=>f.endsWith('.md')&&lstatSync(path.join(directory(k),f)).isFile()).map(f=>k+'/'+f));}
export async function notesRoute(request:Request){const u=new URL(request.url),p=u.pathname,kind=u.searchParams.get('kind')||'daily',day=u.searchParams.get('day')||'';let body:any={};if(request.method==='POST'||request.method==='PUT'){if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error('需要 JSON');const text=await request.text();if(Buffer.byteLength(text)>2500000)throw new Error('请求过大');body=JSON.parse(text);}
 if(p==='/api/notes'){if(request.method==='GET')return readNote(kind,day);if(request.method==='PUT')return writeNote(kind,day,body.text,body.version);}
 if(p==='/api/note-files'&&request.method==='GET')return noteFiles();
 if(p==='/api/note-link'&&request.method==='POST'){dayValid(body.day);directory(body.kind);fileFor(body.path);settings.links[body.kind+':'+body.day]=body.path;saveSettings();return readNote(body.kind,body.day);}
 if(p==='/api/local-settings'){
  if(request.method==='GET')return {home,dailyDir:settings.dailyDir,weeklyDir:settings.weeklyDir};
  if(request.method==='POST'){if(!['daily','weekly'].includes(body.kind))throw new Error('目录类型无效');if(!choose)throw new Error('请在桌面应用中选择目录');const selected=await choose();if(selected){const dir=realpathSync(selected);if(body.kind==='daily')settings.dailyDir=dir;else settings.weeklyDir=dir;saveSettings();}return {home,dailyDir:settings.dailyDir,weeklyDir:settings.weeklyDir};}
 }
 if(p==='/api/full-backup'&&request.method==='POST'){const dbFile=await getD1().snapshot('manual');const notes=Object.fromEntries(noteFiles().map(id=>[id,readFileSync(fileFor(id),'utf8')]));const file=path.join(home,'backups','complete-'+new Date().toISOString().replaceAll(':','-')+'.json.gz');atomic(file,gzipSync(JSON.stringify({format:'workbench-community-full-v1',createdAt:new Date().toISOString(),database:readFileSync(dbFile).toString('base64'),settings,notes})));return {file};}
 throw Object.assign(new Error('不支持此操作'),{status:405});
}
