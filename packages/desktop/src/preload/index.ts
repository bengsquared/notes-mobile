const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ============================================================================
  // ENTITY-SPECIFIC APIs
  // ============================================================================
  
  // Ideas (draft thoughts, unprocessed)
  ideas: {
    list: () => ipcRenderer.invoke('ideas:list'),
    create: (content: string, metadata?: any) => ipcRenderer.invoke('ideas:create', content, metadata),
    load: (filename: string) => ipcRenderer.invoke('ideas:load', filename),
    update: (filename: string, content: string, metadata?: any) => ipcRenderer.invoke('ideas:update', filename, content, metadata),
    delete: (filename: string) => ipcRenderer.invoke('ideas:delete', filename),
    rename: (oldFilename: string, newFilename: string) => ipcRenderer.invoke('ideas:rename', oldFilename, newFilename),
    promote: (ideaFilename: string, title: string, concepts?: string[]) => ipcRenderer.invoke('ideas:promote', ideaFilename, title, concepts),
    attachConcept: (filename: string, conceptName: string) => ipcRenderer.invoke('ideas:attachConcept', filename, conceptName),
    removeConcept: (filename: string, conceptName: string) => ipcRenderer.invoke('ideas:removeConcept', filename, conceptName),
    linkNote: (ideaFilename: string, noteFilename: string) => ipcRenderer.invoke('ideas:linkNote', ideaFilename, noteFilename),
    removeNoteLink: (ideaFilename: string, noteFilename: string) => ipcRenderer.invoke('ideas:removeNoteLink', ideaFilename, noteFilename),
    updateMetadata: (filename: string, metadata: any) => ipcRenderer.invoke('ideas:updateMetadata', filename, metadata)
  },
  
  // Notes (processed items with concepts)
  notes: {
    list: () => ipcRenderer.invoke('notes:list'),
    load: (filename: string) => ipcRenderer.invoke('notes:load', filename),
    save: (filename: string, content: string, metadata: any) => ipcRenderer.invoke('notes:save', filename, content, metadata),
    delete: (filename: string) => ipcRenderer.invoke('notes:delete', filename),
    rename: (oldFilename: string, newFilename: string) => ipcRenderer.invoke('notes:rename', oldFilename, newFilename)
  },
  
  // Concepts (tags with backlinks)
  concepts: {
    list: () => ipcRenderer.invoke('concepts:list'),
    create: (name: string, content: string, metadata?: any) => ipcRenderer.invoke('concepts:create', name, content, metadata),
    load: (name: string) => ipcRenderer.invoke('concepts:load', name),
    save: (name: string, content: string, metadata: any) => ipcRenderer.invoke('concepts:save', name, content, metadata),
    delete: (name: string) => ipcRenderer.invoke('concepts:delete', name),
    getNotesFor: (conceptName: string) => ipcRenderer.invoke('concepts:getNotesFor', conceptName),
    getForNote: (filename: string) => ipcRenderer.invoke('concepts:getForNote', filename),
    addRelation: (fromConcept: string, toConcept: string) => ipcRenderer.invoke('concepts:addRelation', fromConcept, toConcept),
    removeRelation: (fromConcept: string, toConcept: string) => ipcRenderer.invoke('concepts:removeRelation', fromConcept, toConcept)
  },
  
  // Media operations
  media: {
    save: (filename: string, data: string | Buffer, mimeType?: string, noteFilename?: string) => ipcRenderer.invoke('media:save', filename, data, mimeType, noteFilename),
    load: (filename: string) => ipcRenderer.invoke('media:load', filename),
    listForNote: (noteFilename: string) => ipcRenderer.invoke('media:listForNote', noteFilename),
    delete: (filename: string) => ipcRenderer.invoke('media:delete', filename),
    listAll: () => ipcRenderer.invoke('media:listAll')
  },

  // System operations
  integrity: {
    validate: () => ipcRenderer.invoke('integrity:validate'),
    repair: () => ipcRenderer.invoke('integrity:repair')
  },

  // File management utilities
  files: {
    checkUnique: (filename: string, excludeFilename?: string) => ipcRenderer.invoke('files:checkUnique', filename, excludeFilename),
    exists: (filename: string) => ipcRenderer.invoke('files:exists', filename)
  },

  // Relation management
  relations: {
    addNoteConcept: (noteFilename: string, conceptName: string) =>{ console.log("in preload"); ipcRenderer.invoke('relations:addNoteConcept', noteFilename, conceptName)},
    removeNoteConcept: (noteFilename: string, conceptName: string) => ipcRenderer.invoke('relations:removeNoteConcept', noteFilename, conceptName),
    updateNoteConcepts: (noteFilename: string, oldConcepts: string[], newConcepts: string[]) => ipcRenderer.invoke('relations:updateNoteConcepts', noteFilename, oldConcepts, newConcepts),
    addConceptRelation: (fromConcept: string, toConcept: string) => ipcRenderer.invoke('relations:addConceptRelation', fromConcept, toConcept),
    removeConceptRelation: (fromConcept: string, toConcept: string) => ipcRenderer.invoke('relations:removeConceptRelation', fromConcept, toConcept)
  },
  
  search: {
    all: (query: string) => ipcRenderer.invoke('search:all', query),
    notes: (query: string, options?: any) => ipcRenderer.invoke('search:notes', query, options),
    suggestConcepts: async (noteContent: string) => {
      const concepts = await ipcRenderer.invoke('concepts:list');
      const words = noteContent.toLowerCase().split(/\s+/);
      return concepts
        .filter((concept: any) => 
          words.some((word: string) => concept.name.toLowerCase().includes(word) || word.includes(concept.name.toLowerCase()))
        )
        .map((concept: any) => concept.name)
        .slice(0, 5);
    },
    similarNotes: async (filename: string) => {
      const notes = await ipcRenderer.invoke('notes:list');
      return notes.filter((note: any) => note.filename !== filename).slice(0, 5);
    }
  },

  // Content parsing
  content: {
    parse: (content: string) => ipcRenderer.invoke('content:parse', content)
  },

  // App state management
  app: {
    getPinnedItems: () => ipcRenderer.invoke('app:getPinnedItems'),
    pinItem: (type: 'note' | 'concept', name: string) => ipcRenderer.invoke('app:pinItem', type, name),
    unpinItem: (type: 'note' | 'concept', name: string) => ipcRenderer.invoke('app:unpinItem', type, name),
    getRecentNotes: (limit?: number) => ipcRenderer.invoke('app:getRecentNotes', limit)
  },

  // Storage and transfer operations
  storage: {
    getConfig: () => ipcRenderer.invoke('getStorageConfig'),
    generateMCPConfig: () => ipcRenderer.invoke('generateMCPConfig')
  },

  transfer: {
    onNotesReceived: (callback: (notes: any[]) => void) => {
      ipcRenderer.on('notes-received', (_event: any, notes: any[]) => callback(notes));
    },
    onTransferPinGenerated: (callback: (pin: string) => void) => {
      ipcRenderer.on('transfer-pin-generated', (_event: any, pin: string) => callback(pin));
    },
    onPinGenerated: (callback: (pin: string) => void) => {
      ipcRenderer.on('transfer-pin-generated', (_event: any, pin: string) => callback(pin));
    },
    onPinExpired: (callback: () => void) => {
      ipcRenderer.on('pin-expired', (_event: any) => callback());
    },
    generatePin: () => ipcRenderer.invoke('generate-transfer-pin'),
    generateTransferPin: () => ipcRenderer.invoke('generate-transfer-pin'),
    getCurrentPin: () => ipcRenderer.invoke('get-current-pin'),
    clearPin: () => ipcRenderer.invoke('clear-transfer-pin'),
    clearTransferPin: () => ipcRenderer.invoke('clear-transfer-pin')
  }
});