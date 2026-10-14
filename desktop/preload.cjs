const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('folioDesktop',Object.fromEntries(['openWeb','status','login','cancel','select','logout','models','ask'].map(name=>[name,arg=>ipcRenderer.invoke(`folio:${name}`,arg)])));
