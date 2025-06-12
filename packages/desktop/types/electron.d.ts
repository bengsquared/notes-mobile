import type { 
  Note, 
  NoteMetadata, 
  Concept, 
  ConceptMetadata, 
  MediaFile,
  StorageConfig,
  SearchOptions,
  ParsedContent,
  ValidationReport
} from '@notes-app/shared'
import type { Idea } from '../src/lib/storage'

export interface ElectronAPI {
  // ============================================================================
  // ENTITY-SPECIFIC APIs
  // ============================================================================
  
  // Ideas (draft thoughts, unprocessed)
  ideas: {
    list: () => Promise<Idea[]>
    create: (content: string, metadata?: any) => Promise<Idea>
    load: (filename: string) => Promise<Idea>
    update: (filename: string, content: string, metadata?: any) => Promise<Idea>
    delete: (filename: string) => Promise<void>
    rename: (oldFilename: string, newFilename: string) => Promise<boolean>
    promote: (ideaFilename: string, title: string, concepts?: string[]) => Promise<Note>
    // Metadata operations for concept/note linking
    attachConcept: (filename: string, conceptName: string) => Promise<void>
    removeConcept: (filename: string, conceptName: string) => Promise<void>
    linkNote: (ideaFilename: string, noteFilename: string) => Promise<void>
    removeNoteLink: (ideaFilename: string, noteFilename: string) => Promise<void>
    updateMetadata: (filename: string, metadata: any) => Promise<void>
  }
  
  // Notes (processed items with concepts)
  notes: {
    list: () => Promise<Note[]>
    load: (filename: string) => Promise<Note>
    save: (filename: string, content: string, metadata: any) => Promise<boolean>
    delete: (filename: string) => Promise<boolean>
    rename: (oldFilename: string, newFilename: string) => Promise<boolean>
  }
  
  // Concepts (tags with backlinks)
  concepts: {
    list: () => Promise<Concept[]>
    create: (name: string, content: string, metadata?: any) => Promise<boolean>
    load: (name: string) => Promise<Concept>
    save: (name: string, content: string, metadata: any) => Promise<boolean>
    delete: (name: string) => Promise<boolean>
    getNotesFor: (conceptName: string) => Promise<string[]>
    getForNote: (filename: string) => Promise<string[]>
    addRelation: (fromConcept: string, toConcept: string) => Promise<void>
    removeRelation: (fromConcept: string, toConcept: string) => Promise<void>
  }
  
  // Media operations
  media: {
    save: (filename: string, data: string | Buffer, mimeType?: string, noteFilename?: string) => Promise<string>
    load: (filename: string) => Promise<{ data: string; mimeType: string }>
    listForNote: (noteFilename: string) => Promise<MediaFile[]>
    delete: (filename: string) => Promise<boolean>
    listAll: () => Promise<MediaFile[]>
  }

  // System operations
  integrity: {
    validate: () => Promise<ValidationReport>
    repair: () => Promise<{ fixed: number; issues: string[] }>
  }

  // File management utilities
  files: {
    checkUnique: (filename: string, excludeFilename?: string) => Promise<boolean>
    exists: (filename: string) => Promise<boolean>
  }

  // Relation management
  relations: {
    addNoteConcept: (noteFilename: string, conceptName: string) => Promise<void>
    removeNoteConcept: (noteFilename: string, conceptName: string) => Promise<void>
    updateNoteConcepts: (noteFilename: string, oldConcepts: string[], newConcepts: string[]) => Promise<void>
  }
  
  // Search operations
  search: {
    all: (query: string) => Promise<{
      ideas: Idea[]
      notes: Note[]
      concepts: Concept[]
    }>
    notes: (query: string, options?: SearchOptions) => Promise<Note[]>
    suggestConcepts: (noteContent: string) => Promise<string[]>
    similarNotes: (filename: string) => Promise<Note[]>
  }

  // Content parsing
  content: {
    parse: (content: string) => Promise<ParsedContent>
  }

  // App state management
  app: {
    getPinnedItems: () => Promise<{ notes: string[], concepts: string[] }>
    pinItem: (type: 'note' | 'concept', name: string) => Promise<boolean>
    unpinItem: (type: 'note' | 'concept', name: string) => Promise<boolean>
    getRecentNotes: (limit?: number) => Promise<Note[]>
  }

  // Storage operations
  storage: {
    getConfig: () => Promise<StorageConfig>
    generateMCPConfig: () => Promise<{
      configPath: string
      mcpConfig: { mcpServers: { [key: string]: { command: string; args: string[]; description: string } } }
      appPath: string
      isDev: boolean
    }>
  }

  // Transfer operations
  transfer: {
    onNotesReceived: (callback: (notes: any[]) => void) => void
    onTransferPinGenerated: (callback: (pin: string) => void) => void
    onPinGenerated: (callback: (pin: string) => void) => void
    onPinExpired: (callback: () => void) => void
    generatePin: () => Promise<string>
    generateTransferPin: () => Promise<string>
    getCurrentPin: () => Promise<string | null>
    clearPin: () => Promise<boolean>
    clearTransferPin: () => Promise<boolean>
  }

  // Top-level APIs (for settings page compatibility)
  getStorageConfig: () => Promise<StorageConfig>
  generateMCPConfig: () => Promise<{
    configPath: string
    mcpConfig: { mcpServers: { [key: string]: { command: string; args: string[]; description: string } } }
    appPath: string
    isDev: boolean
  }>
  selectNotesDirectory: () => Promise<string | null>
  restartApp: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export { Note, NoteMetadata, Concept, ConceptMetadata, MediaFile, StorageConfig, SearchOptions, ParsedContent, ValidationReport, ElectronAPI }