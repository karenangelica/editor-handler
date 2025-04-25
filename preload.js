const { contextBridge, ipcRenderer } = require('electron');

// Expose the validatePath function to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  validatePath: (filePath) => ipcRenderer.invoke('validate-path', filePath),
});