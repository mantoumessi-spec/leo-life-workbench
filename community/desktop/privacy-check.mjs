// No private deny-list is embedded: checks use generic formats and an allowlist.
import {execFileSync} from 'node:child_process';
import {readFileSync,readdirSync,lstatSync,existsSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const findings=[];
function checkText(data,label){
 if(data.includes(0))return;
 const text=data.toString('utf8');
 const patterns={credential:/gh[pousr]_[A-Za-z0-9]{25,}|sk-[A-Za-z0-9_-]{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
 privateSite:/[a-z0-9.-]+\.chatgpt\.site|appgprj_[a-z0-9]+|docs\.google\.com\/spreadsheets\/d\//i,
 localPath:/\/Users\/[^/\s]+\/|[A-Z]:\\Users\\[^\\\s]+\\/};
 for(const [kind,re] of Object.entries(patterns))if(re.test(text))findings.push(`${kind}: ${label}`);
 for(const email of (label.endsWith('THIRD-PARTY-NOTICES.txt')?[]:text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g)||[])){
  if(!/@(?:sites\.test|example\.com|users\.noreply\.github\.com)$/.test(email)&&!/^\d/.test(email))findings.push(`email: ${label}`);
 }
}
const forbidden=/(^|\/)(?:\.git|\.wrangler|\.local-backups|\.sites-runtime|\.env[^/]*|\.dev\.vars[^/]*|backups|exports|\.private)(\/|$)|\.(?:sqlite(?:-wal|-shm)?|db|pem|key|map|tsbuildinfo)$/i;
if(process.argv.includes('--history')){
 const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:100*1024*1024});
 const commits=git('rev-list','--branches','--tags').toString().trim().split('\n');const seen=new Set();
 for(const commit of commits){
  checkText(git('show','-s','--format=%an <%ae>%n%cn <%ce>%n%B',commit),`commit ${commit.slice(0,8)}`);
  for(const row of git('ls-tree','-r',commit).toString().trim().split('\n')){
   const [meta,path]=row.split('\t'),oid=meta.split(' ')[2];
   if(forbidden.test(path))findings.push(`private file: ${path}`);
   if(seen.has(oid))continue;seen.add(oid);checkText(git('cat-file','blob',oid),path);
  }
 }
 console.log(`Scanned ${commits.length} reachable commits and ${seen.size} unique files. Images require manual review.`);
}else{
 const directory=resolve(process.argv[2]||join(root,'community/dist/desktop/app'));
 function walk(dir){for(const name of readdirSync(dir)){const full=join(dir,name),path=relative(directory,full),stat=lstatSync(full);if(stat.isSymbolicLink())throw new Error('Unexpected payload symlink: '+path);if(forbidden.test(path))findings.push('private file: '+path);if(stat.isDirectory())walk(full);else checkText(readFileSync(full),path);}}
 if(!existsSync(directory))throw new Error('Build payload first');walk(directory);
 const names=readdirSync(directory).sort();
 const allowed=['LICENSE','THIRD-PARTY-NOTICES.txt','client','main.cjs','migrations','package.json','routes.cjs'];
 for(const name of names)if(!allowed.includes(name))findings.push('Unexpected payload file: '+name);
 console.log('Scanned desktop payload (program allowlist; no runtime database/history permitted).');
}
if(findings.length){console.error([...new Set(findings)].join('\n'));process.exitCode=1;}else console.log('PASS: no matched private content. This is a pattern check, not a guarantee about arbitrary prose or previously downloaded copies.');
