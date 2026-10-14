import * as workspace from '../app/api/workspace/route';
import * as reviews from '../app/api/ai-review/route';
export {initialize,close} from './db';
export async function route(request:Request){
  const url=new URL(request.url);
  if(url.origin!=='https://workbench.local')return new Response('Forbidden',{status:403});
  const routes:Record<string,Record<string,Function>>={'/api/workspace':{GET:workspace.GET,PUT:workspace.PUT},'/api/ai-review':{GET:reviews.GET,POST:reviews.POST}};
  const handler=routes[url.pathname]?.[request.method];
  if(typeof handler!=='function')return new Response('Not available',{status:404});
  return handler(request);
}
