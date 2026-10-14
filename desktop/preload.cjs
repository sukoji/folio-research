const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('folioDesktop',{
  ...Object.fromEntries(['minimize','maximize','close','windowState','openWeb','status','login','cancel','select','logout','models','ask'].map(name=>[name,arg=>ipcRenderer.invoke(`folio:${name}`,arg)])),
  onWindowState:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('folio:window-state',listener);return()=>ipcRenderer.removeListener('folio:window-state',listener);}
});
