import * as workspace from '../app/api/workspace/route';
import * as reviews from '../app/api/ai-review/route';
import {initialize as initializeDb} from './db';
import {initializeNotes,notesRoute} from './notes';
export {close} from './db';
export async function initialize(directory:string,migrations:string,picker?:()=>Promise<string|null>){await initializeDb(directory,migrations);initializeNotes(directory,picker);}
export async function route(request:Request){
  const url=new URL(request.url);
  if(url.origin!=='https://workbench.local'||(request.headers.get('origin')&&request.headers.get('origin')!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return Response.json({error:'Forbidden'},{status:403});
  if(['/api/notes','/api/note-files','/api/note-link','/api/local-settings','/api/full-backup'].includes(url.pathname)){try{return Response.json(await notesRoute(request),{headers:{'Cache-Control':'no-store'}});}catch(e:any){return Response.json({error:e.message,current:e.current},{status:e.status||400});}}
  const routes:Record<string,Record<string,Function>>={'/api/workspace':{GET:workspace.GET,PUT:workspace.PUT},'/api/ai-review':{GET:reviews.GET,POST:reviews.POST}};
  const handler=routes[url.pathname]?.[request.method];
  if(typeof handler!=='function')return new Response('Not available',{status:404});
  return handler(request);
}
