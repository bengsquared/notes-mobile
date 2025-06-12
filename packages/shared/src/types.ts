export interface QuickNote {
  id: string
  content: string
  createdAt: string
  updatedAt: string
  tags?: string[]
}

export interface DeepNote extends QuickNote {
  title: string
  linkedNotes?: string[]
  collections?: string[]
  processed: boolean
}

export interface QuickNoteCollection {
  id: string
  name: string
  color?: string
  noteIds: string[]
}

// New types for filesystem-based storage
export interface NoteMetadata {
  title?: string
  concepts?: string[]  // Tags/concepts using # notation
  links?: string[]     // Links to other notes using @ notation
  backlinks?: string[] // Notes that link to this note
  created?: string
  modified?: string
  processed?: boolean  // Whether the note/idea has been processed
}

export interface Note {
  filename: string
  content: string
  metadata: NoteMetadata
  location: 'inbox' | 'notes'
}

export interface ConceptMetadata {
  linkedNotes?: string[]
  relatedConcepts?: string[]
  created?: string
  modified?: string
}

export interface Concept {
  name: string
  content: string
  metadata: ConceptMetadata
}

export interface MediaFile {
  filename: string
  mimeType: string
  size: number
  modified: string
}

export interface StorageConfig {
  notesDirectory: string
  initialized: boolean
}

export interface SearchOptions {
  includeInbox?: boolean
  concepts?: string[]
  sortBy?: 'modified' | 'created' | 'title'
}

export interface ParsedContent {
  concepts: string[]     // #concept mentions
  noteLinks: string[]    // @note mentions
  externalLinks: string[]
}

export interface ValidationIssue {
  type: 'orphaned-backlink' | 'missing-backlink' | 'broken-link' | 'invalid-concept' | 'orphaned-media'
  severity: 'error' | 'warning'
  source: string
  target?: string
  description: string
}

export interface ValidationReport {
  hasIssues: boolean
  issues: ValidationIssue[]
  repaired?: number  // Number of issues that were automatically repaired
  stats: {
    notesChecked: number
    conceptsChecked: number
    relationsChecked: number
    mediaChecked: number
  }
}

export interface TransferPayload {
  notes: QuickNote[]
  timestamp: string
}

export interface RPCRequest {
  method: string
  params?: any
  id?: string | number
}

export interface RPCResponse {
  result?: any
  error?: {
    code: number
    message: string
  }
  id?: string | number
}