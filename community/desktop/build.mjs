import {build as viteBuild} from 'vite';
import {build as bundle} from 'esbuild';
import react from '@vitejs/plugin-react';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync,rmSync,copyFileSync,writeFileSync,readdirSync,readFileSync,existsSync} from 'node:fs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..'),out=resolve(root,'dist/desktop/app');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
const libraries=new Set(['react','react-dom','scheduler','lucide-react','zod','drizzle-orm','tailwindcss']);
const noticePlugin={name:'collect-runtime-licenses',generateBundle(_options,output){for(const chunk of Object.values(output)){if(chunk.type!=='chunk')continue;for(const id of Object.keys(chunk.modules)){const m=id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);if(m)libraries.add(m[1]);}}}};
await viteBuild({configFile:false,root:here,publicDir:false,plugins:[react(),noticePlugin],define:{__LEO_DESKTOP__:'true'},css:{postcss:resolve(root)},build:{outDir:resolve(out,'client'),emptyOutDir:true,sourcemap:false},resolve:{alias:{'@':root}}});
await bundle({entryPoints:[resolve(here,'routes.ts')],outfile:resolve(out,'routes.cjs'),bundle:true,platform:'node',format:'cjs',target:'node24',sourcemap:false,plugins:[{name:'desktop-adapters',setup(build){
 build.onResolve({filter:/chatgpt-auth$/},()=>({path:resolve(here,'auth.ts')}));
 build.onResolve({filter:/^(\.\.\/)+db$/},()=>({path:resolve(here,'db.ts')}));
}}]});
copyFileSync(resolve(here,'main.cjs'),resolve(out,'main.cjs'));
mkdirSync(resolve(out,'migrations'));
for(const name of readdirSync(resolve(root,'drizzle')).filter(n=>/^\d+.*\.sql$/.test(n)))copyFileSync(resolve(root,'drizzle',name),resolve(out,'migrations',name));
writeFileSync(resolve(out,'package.json'),JSON.stringify({name:'leo-workbench',productName:'Leo Workbench',version:'0.3.1',main:'main.cjs',author:'Leo Workbench contributors',private:true,license:'MIT'}));
copyFileSync(resolve(root,'../LICENSE'),resolve(out,'LICENSE'));
let notices='Third-party runtime licenses. Electron/Chromium notices accompany the runtime.\n';
for(const name of [...libraries].sort()){const dir=resolve(root,'node_modules',name);const license=['LICENSE','LICENSE.md','LICENSE.txt','license','license.md'].find(n=>existsSync(resolve(dir,n)));const licensePath=license?resolve(dir,license):resolve(here,'licenses',name+'-LICENSE.txt');if(!existsSync(licensePath))throw new Error('Missing license for '+name);notices+='\n--- '+name+' ---\n'+readFileSync(licensePath,'utf8')+'\n';}
writeFileSync(resolve(out,'THIRD-PARTY-NOTICES.txt'),notices);
console.log('Desktop payload built using explicit program-file allowlist:',out);
