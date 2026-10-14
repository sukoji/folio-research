const { app, BrowserWindow, ipcMain, shell, safeStorage, dialog } = require('electron');
const { fork } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
let window, server, accounts, origin;
const root = path.resolve(__dirname,'..');
if(!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(window){window.restore();window.focus();}});
  app.whenReady().then(async()=>{
    try {
      const data = path.join(app.getPath('userData'),'workspace');fs.mkdirSync(data,{recursive:true});
      const runtime = app.isPackaged ? path.join(root,'runtime',process.platform==='win32'?'node.exe':'node') : process.env.FOLIO_NODE_PATH || 'node';
      server=fork(path.join(root,'src/server.mjs'),['--port','0','--data-dir',data],{
        execPath:runtime,execArgv:[],windowsHide:true,stdio:['ignore','ignore','pipe','ipc'],
        env:{...process.env,FOLIO_NODE_PATH:runtime,FOLIO_TECTONIC_PATH:path.join(root,app.isPackaged?'runtime':'data/tools/tectonic',process.platform==='win32'?'tectonic.exe':'tectonic')}
      });
      let lastError='';server.stderr.on('data',chunk=>{lastError=(lastError+chunk).slice(-3000);});
      const port=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Local server did not start.')),30000);server.once('message',message=>{clearTimeout(timer);resolve(message.port);});server.once('exit',()=>{clearTimeout(timer);reject(new Error(lastError||'Local server exited.'));});server.once('error',reject);});
      origin=`http://127.0.0.1:${port}`;
      const { Accounts }=await import('./auth.mjs');
      accounts=new Accounts(app.getPath('userData'),safeStorage,url=>shell.openExternal(url));
      const handlers={minimize:()=>window.minimize(),maximize:()=>{window.isMaximized()?window.unmaximize():window.maximize();return window.isMaximized();},close:()=>window.close(),windowState:()=>({maximized:window.isMaximized()}),openWeb:()=>shell.openExternal(origin),status:()=>accounts.status(),login:id=>accounts.login(id),cancel:()=>accounts.cancel(),select:id=>accounts.select(id),logout:id=>accounts.logout(id),models:()=>accounts.models(),ask:args=>accounts.ask(args)};
      for(const [name,handler] of Object.entries(handlers))ipcMain.handle(`folio:${name}`,(event,arg)=>{
        if(event.sender!==window?.webContents || event.senderFrame!==window.webContents.mainFrame || new URL(event.senderFrame.url).origin!==origin)throw new Error('Forbidden sender.');
        return handler(arg);
      });
      window=new BrowserWindow({width:1440,height:960,minWidth:900,minHeight:640,title:'Folio',frame:false,icon:path.join(root,'web/folio.png'),backgroundColor:'#202522',show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
      const sendWindowState=()=>window.webContents.send('folio:window-state',{maximized:window.isMaximized()});
      window.on('maximize',sendWindowState);window.on('unmaximize',sendWindowState);
      window.removeMenu();
      window.webContents.session.setPermissionRequestHandler((_web,_permission,callback)=>callback(false));
      window.webContents.setWindowOpenHandler(({url})=>{if(new URL(url).protocol==='https:' || new URL(url).origin===origin)void shell.openExternal(url);return {action:'deny'};});
      window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
      window.webContents.on('will-prevent-unload',event=>{if(dialog.showMessageBoxSync(window,{type:'warning',buttons:['돌아가기','저장하지 않고 닫기'],defaultId:0,cancelId:0,message:'저장되지 않은 변경이 있습니다.'})===1)event.preventDefault();});
      window.once('ready-to-show',()=>window.show());await window.loadURL(origin);window.show();
      server.on('exit',()=>{if(window&&!window.isDestroyed())void dialog.showMessageBox(window,{type:'error',message:'로컬 서버가 종료되었습니다. Folio를 다시 실행하세요.'});});
    }catch(error){dialog.showErrorBox('Folio 시작 실패',error.message);app.quit();}
  });
  app.on('window-all-closed',()=>app.quit());
  app.on('will-quit',()=>{accounts?.cancel();server?.kill();});
}

