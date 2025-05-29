const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onNotesReceived: (callback: (notes: any[]) => void) => {
    ipcRenderer.on('notes-received', (_event: any, notes: any[]) => callback(notes));
  },
  getNotesDirectory: () => ipcRenderer.invoke('get-notes-directory'),
  setNotesDirectory: (path: string) => ipcRenderer.invoke('set-notes-directory', path),
  
  saveNote: async (filename: string, content: string) => {
    return ipcRenderer.invoke('save-note', filename, content);
  },
  
  loadNote: async (filename: string) => {
    return ipcRenderer.invoke('load-note', filename);
  },
  
  listNotes: async () => {
    return ipcRenderer.invoke('list-notes');
  },
  
  deleteNote: async (filename: string) => {
    return ipcRenderer.invoke('delete-note', filename);
  }
});