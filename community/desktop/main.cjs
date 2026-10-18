const {app,BrowserWindow,protocol,session,dialog,Menu,shell}=require('electron');
const {join,resolve,extname}=require('node:path');
const {readFile}=require('node:fs/promises');
const runtime=require('./routes.cjs');
const ORIGIN='https://workbench.local';
app.setName('Leo Workbench');
// Stable across executable upgrades. Test launches explicitly use an isolated path.
if(process.env.LEO_DESKTOP_TEST_DATA)app.setPath('userData',resolve(process.env.LEO_DESKTOP_TEST_DATA));
let window;
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
app.whenReady().then(async()=>{
  const fs=require('node:fs');
  const config=join(app.getPath('userData'),'storage-location.json');
  let dataDir=app.getPath('userData');
  if(fs.existsSync(config))dataDir=JSON.parse(fs.readFileSync(config,'utf8')).directory;
  else if(!process.env.LEO_DESKTOP_TEST_DATA&&!fs.existsSync(join(dataDir,'workbench.sqlite'))){
    const answer=await dialog.showMessageBox({type:'question',title:'选择记录保存位置',message:'你的记录只保存在自己的电脑',detail:'使用默认文件夹最省心；也可以选择一个专门存放工作台数据的空文件夹。以后升级不会覆盖这里。',buttons:['使用默认文件夹','选择文件夹'],defaultId:0,cancelId:0});
    if(answer.response===1){const chosen=await dialog.showOpenDialog({title:'选择工作台数据文件夹',properties:['openDirectory','createDirectory']});if(!chosen.canceled&&chosen.filePaths[0])dataDir=chosen.filePaths[0];}
    fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(config,JSON.stringify({directory:dataDir}));
  }
  await runtime.initialize(dataDir,join(__dirname,'migrations'),async()=>{const chosen=await dialog.showOpenDialog(window,{title:'选择日记或周记所在文件夹（只读写该目录的 Markdown 文件）',properties:['openDirectory','createDirectory']});return chosen.canceled?null:chosen.filePaths[0];});
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  session.defaultSession.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith(ORIGIN+'/')&&!details.url.startsWith('blob:'+ORIGIN+'/')}));
  protocol.handle('https',async request=>{
    const url=new URL(request.url);
    if(url.origin!==ORIGIN)return new Response('Forbidden',{status:403});
    if(url.pathname.startsWith('/api/')){
      // Electron's protocol bridge may omit Origin for same-origin fetches.
      // Only this session's local page can reach this in-process handler; no port
      // is exposed, remote navigation/requests are denied, and supplied foreign
      // origins still fail closed. Hosted API origin checks remain unchanged.
      const origin=request.headers.get('origin');
      if((origin&&origin!==ORIGIN)||request.headers.get('sec-fetch-site')==='cross-site')return new Response('Forbidden',{status:403});
      const headers=new Headers(request.headers);headers.set('origin',ORIGIN);
      return runtime.route(new Request(request,{headers}));
    }
    if(request.method!=='GET')return new Response('Method not allowed',{status:405});
    const path=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
    const root=resolve(__dirname,'client'),file=resolve(root,path);
    if(!file.startsWith(root+require('node:path').sep))return new Response('Forbidden',{status:403});
    try{return new Response(await readFile(file),{headers:{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-src 'none'",'X-Content-Type-Options':'nosniff'}});}catch{return new Response('Not found',{status:404});}
  });
  const openExternal=url=>{
    try{const u=new URL(url);if(u.protocol==='https:'&&(u.hostname==='chatgpt.com'||(u.hostname==='github.com'&&u.pathname.startsWith('/mantoumessi-spec/leo-life-workbench'))))void shell.openExternal(url);}catch{}
  };
  function createWindow(){
    window=new BrowserWindow({width:1320,height:900,minWidth:780,minHeight:600,backgroundColor:'#f6f7f2',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
    window.webContents.setWindowOpenHandler(({url})=>{openExternal(url);return {action:'deny'};});
    window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==ORIGIN){event.preventDefault();openExternal(url);}});
    window.webContents.on('will-prevent-unload',event=>{
      const choice=dialog.showMessageBoxSync(window,{type:'warning',buttons:['继续等待保存','仍然退出'],defaultId:0,cancelId:0,message:'还有内容未保存完成',detail:'建议等页面显示已保存后再退出。'});
      if(choice===1)event.preventDefault();
    });
    void window.loadURL(ORIGIN+'/');
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform==='darwin'?[{role:'appMenu'}]:[]),
    {label:'文件',submenu:[{label:'打开数据和备份文件夹',click:()=>shell.openPath(dataDir)},{type:'separator'},{role:'quit'}]},
    {label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
    {label:'视图',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]},
  ]));
  createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
}).catch(error=>{dialog.showErrorBox('工作台暂时无法打开','你的记录仍保留在本机。请保存以下错误并反馈：\n'+error.message);app.quit();});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('will-quit',()=>runtime.close());
}
