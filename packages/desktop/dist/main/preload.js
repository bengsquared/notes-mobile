"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    onNotesReceived: (callback) => {
        ipcRenderer.on('notes-received', (_event, notes) => callback(notes));
    },
    getNotesDirectory: () => ipcRenderer.invoke('get-notes-directory'),
    setNotesDirectory: (path) => ipcRenderer.invoke('set-notes-directory', path),
    saveNote: async (filename, content) => {
        return ipcRenderer.invoke('save-note', filename, content);
    },
    loadNote: async (filename) => {
        return ipcRenderer.invoke('load-note', filename);
    },
    listNotes: async () => {
        return ipcRenderer.invoke('list-notes');
    },
    deleteNote: async (filename) => {
        return ipcRenderer.invoke('delete-note', filename);
    }
});
