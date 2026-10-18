import {execFileSync} from 'node:child_process';
import {packager} from '@electron/packager';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const [platform=process.platform,arch=process.arch]=process.argv.slice(2);
if(!['darwin','win32'].includes(platform)||!['arm64','x64'].includes(arch))throw new Error('Unsupported target');
const paths=await packager({dir:resolve(here,'../dist/desktop/app'),out:resolve(here,'../dist/desktop/packages'),name:'Leo Workbench',appBundleId:'org.leoworkbench.desktop',executableName:'LeoWorkbench',appVersion:'0.3.0',electronVersion:'44.7.2',...(process.env.LEO_ELECTRON_ZIP_DIR?{electronZipDir:process.env.LEO_ELECTRON_ZIP_DIR}:{}),platform,arch,asar:true,overwrite:true,prune:false,osxSign:false,osxNotarize:false});
// Replacing the original Electron app invalidates its resource envelope.
// Ad-hoc signing restores local bundle integrity; this is not Apple notarization.
if(platform==='darwin'&&process.platform==='darwin')for(const folder of paths){
 const bundle=resolve(folder,'Leo Workbench.app');
 execFileSync('codesign',['--force','--deep','--sign','-',bundle],{stdio:'inherit'});
 execFileSync('codesign',['--verify','--deep','--strict',bundle],{stdio:'inherit'});
}
console.log(paths);
