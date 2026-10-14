import {spawn} from 'node:child_process';
import {existsSync,readFileSync,mkdirSync,cpSync,realpathSync,openSync,closeSync,unlinkSync} from 'node:fs';
import {dirname,join,delimiter,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createServer} from 'node:net';
const root=fileURLToPath(new URL('../',import.meta.url));
export function supportedNode(version){const [major,minor]=version.split('.').map(Number);return major>22||(major===22&&minor>=13);}
export function npmCli(execPath=process.execPath,pathValue=process.env.PATH||'',platform=process.platform){
 const dirs=[dirname(execPath),...pathValue.split(delimiter).filter(Boolean)];
 for(const dir of dirs){for(const p of [join(dir,'node_modules/npm/bin/npm-cli.js'),join(dir,'../lib/node_modules/npm/bin/npm-cli.js'),join(dir,platform==='win32'?'npm.cmd':'npm')]){
  try{const actual=realpathSync(p);if(actual.endsWith('npm-cli.js'))return actual;}catch{}
 }}throw new Error('没有找到 npm。请重新安装 Node.js 24 LTS，再重新打开此窗口。');
}
export function dependenciesReady(directory=root){
 try{const lock=JSON.parse(readFileSync(join(directory,'package-lock.json'),'utf8'));const pkg=JSON.parse(readFileSync(join(directory,'package.json'),'utf8'));
  return Object.keys({...pkg.dependencies,...pkg.devDependencies}).every(name=>JSON.parse(readFileSync(join(directory,'node_modules',name,'package.json'),'utf8')).version===lock.packages['node_modules/'+name].version);
 }catch{return false;}
}
export async function availablePort(port=5173){return new Promise((resolve,reject)=>{const server=createServer();server.once('error',reject);server.listen(port,'127.0.0.1',()=>server.close(()=>resolve(true)));});}
export function snapshot(directory=root){
 const source=join(directory,'.wrangler/state');if(!existsSync(source))return null;
 const dest=join(directory,'.local-backups',new Date().toISOString().replaceAll(':','-')+'-'+process.pid,'state');
 cpSync(source,dest,{recursive:true,errorOnExist:true,force:false});return dirname(dest);
}
function run(args){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',CLOUDFLARE_CF_FETCH_ENABLED:'false'}});child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve():reject(new Error(`操作未完成（${signal||code}）。已有数据不会被安装程序清空。`)));});}
async function main(){
 const command=process.argv[2]||'start';if(!['start','setup','backup','check'].includes(command))throw new Error('可用命令：start / setup / backup / check');
 if(!supportedNode(process.versions.node))throw new Error('需要 Node.js 22.13 或以上版本，推荐安装 Node.js 24 LTS。');
 console.log(`Leo 本地工作台\n程序目录：${root}\n数据目录：${join(root,'.wrangler/state')}\n记录只保存在这台电脑；请定期导出备份。\n`);
 const cli=npmCli();if(command==='check'){console.log(`Node.js ${process.versions.node}\n依赖${dependenciesReady()?'已就绪':'需要安装'}\nnpm 已找到`);return;}
 try{await availablePort();}catch{throw new Error('5173 端口已被占用。若工作台已经启动，请使用原窗口；安装或备份前请先按 Ctrl+C 停止它。不自动更换端口，以免浏览器草稿看起来丢失。');}
 mkdirSync(join(root,'.sites-runtime'),{recursive:true});const lock=join(root,'.sites-runtime/launcher.lock');let fd;
 try{fd=openSync(lock,'wx');}catch{throw new Error('另一个安装或启动窗口正在运行。请先关闭它；若此前异常退出，请确认所有工作台窗口已停止后删除 community/.sites-runtime/launcher.lock。');}
 try{
  if(command==='backup'){const dest=snapshot();console.log(dest?`完整本地数据库已备份到：\n${dest}\n请另存到独立磁盘；浏览器中未保存的草稿不在此副本中。`:'还没有本地数据库。先启动并记录内容后再备份。');return;}
  if(command==='setup'||!dependenciesReady()){
   console.log('正在安装依赖，首次需要联网，可能需要几分钟……');
   await run([cli,'ci','--no-audit','--no-fund']);if(!dependenciesReady())throw new Error('依赖没有完整安装。请检查磁盘空间和网络，然后重新运行首次安装。');
  }
  const backup=snapshot();if(backup)console.log(`数据库迁移前的副本：${backup}`);
  await run([join(root,'node_modules/wrangler/bin/wrangler.js'),'d1','migrations','apply','DB','--local','--config','wrangler.local.jsonc']);
  if(command==='setup'){console.log('\n安装完成。以后双击“启动工作台”即可。');return;}
  console.log('\n启动后打开：http://127.0.0.1:5173\n请保留此窗口。退出前确认页面显示已保存，再在这里按 Ctrl+C。\n');
  const child=spawn(process.execPath,[join(root,'scripts/run-framework.mjs'),'dev'],{cwd:root,stdio:'inherit'});
  const stop=()=>{child.kill('SIGTERM');};process.once('SIGINT',stop);process.once('SIGTERM',stop);
  let exited=false;child.once('exit',()=>{exited=true;});
  if(!process.argv.includes('--no-open'))void(async()=>{
   for(let attempt=0;attempt<120&&!exited;attempt++){
    try{const r=await fetch('http://127.0.0.1:5173/',{redirect:'manual',signal:AbortSignal.timeout(1000)});if(r.status===200||r.status===302||r.status===307){
     const target='http://127.0.0.1:5173';const cmd=process.platform==='win32'?'rundll32.exe':process.platform==='darwin'?'open':'xdg-open';const args=process.platform==='win32'?['url.dll,FileProtocolHandler',target]:[target];
     const browser=spawn(cmd,args,{stdio:'ignore'});browser.on('error',()=>console.log('请手动在浏览器打开上述网址。'));return;
    }}catch{}await new Promise(r=>setTimeout(r,500));
   }
  })();
  await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>code===0||signal?resolve():reject(new Error('启动未完成，请保留上方错误并反馈。')));});
  process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
 }finally{if(fd!==undefined){closeSync(fd);unlinkSync(lock);}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error('\n'+e.message);process.exitCode=1;});
