import {extractAll} from '@electron/asar';
import {mkdtempSync,readFileSync,readdirSync,lstatSync,rmSync} from 'node:fs';
import {join,resolve,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../dist/desktop');
for(const target of ['darwin-arm64','darwin-x64','win32-x64']){
 const file=join(root,'packages','Leo Workbench-'+target,target.startsWith('darwin')?'Leo Workbench.app/Contents/Resources/app.asar':'resources/app.asar');
 const folder=mkdtempSync(join(tmpdir(),'leo-payload-audit-'));
 try{
  extractAll(file,folder);execFileSync(process.execPath,[resolve(import.meta.dirname,'privacy-check.mjs'),folder],{stdio:'inherit'});
  function compare(dir){for(const n of readdirSync(dir)){const f=join(dir,n),p=relative(folder,f);if(lstatSync(f).isDirectory())compare(f);else if(p==='package.json'){const expected=JSON.parse(readFileSync(join(root,'app',p)));delete expected.private;assert.deepEqual(JSON.parse(readFileSync(f)),expected);}else assert.ok(readFileSync(f).equals(readFileSync(join(root,'app',p))),'Payload differs '+target+' '+p);}}
  compare(folder);console.log('PASS: '+target+' payload matches reviewed program; packager removes private package flag only.');
 }finally{rmSync(folder,{recursive:true,force:true});}
}
