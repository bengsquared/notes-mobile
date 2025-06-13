/**
 * IPC Handlers V2 - Entity-specific APIs with referential integrity
 * 
 * These handlers provide clean, entity-specific APIs that maintain referential integrity
 * and separate concerns between ideas, notes, and concepts.
 */

import { ipcMain } from 'electron'
import { NotesStorage, Idea } from '../lib/storage'
import { Concept, Note } from '@notes-app/shared'

export class IPCHandlers {
  private storage: NotesStorage | null

  constructor(storage: NotesStorage | null) {
    this.storage = storage
    this.registerHandlers()
  }

  // Method to update the storage reference when directory changes
  updateStorage(newStorage: NotesStorage) {
    this.storage = newStorage
  }

  // Helper method to check if storage is available
  private ensureStorage(): NotesStorage {
    if (!this.storage) {
      throw new Error('Storage not initialized. Please configure a notes directory first.')
    }
    return this.storage
  }

  private registerHandlers() {
    // ============================================================================
    // IDEAS (Draft thoughts, unprocessed)
    // ============================================================================

    ipcMain.handle('ideas:list', async (): Promise<Idea[]> => {
      return await this.ensureStorage().listIdeas()
    })

    ipcMain.handle('ideas:create', async (_, content: string, metadata?: any): Promise<Idea> => {
      return await this.ensureStorage().createIdea(content, metadata)
    })

    ipcMain.handle('ideas:load', async (_, filename: string): Promise<Idea> => {
      return await this.ensureStorage().loadIdea(filename)
    })

    ipcMain.handle('ideas:update', async (_, filename: string, content: string, metadata?: any): Promise<Idea> => {
      return await this.ensureStorage().updateIdea(filename, content, metadata)
    })

    ipcMain.handle('ideas:delete', async (_, filename: string): Promise<void> => {
      return await this.ensureStorage().deleteIdea(filename)
    })

    ipcMain.handle('ideas:rename', async (_, oldFilename: string, newFilename: string): Promise<boolean> => {
      return await this.ensureStorage().renameNote(oldFilename, newFilename)
    })

    ipcMain.handle('ideas:promote', async (_, ideaFilename: string, title: string, concepts?: string[]): Promise<Note> => {
      return await this.ensureStorage().promoteIdeaToNote(ideaFilename, title, concepts)
    })

    // Idea metadata operations for unified context sidebar
    ipcMain.handle('ideas:attachConcept', async (_, filename: string, conceptName: string): Promise<void> => {
      return await this.ensureStorage().attachConceptToIdea(filename, conceptName)
    })

    ipcMain.handle('ideas:removeConcept', async (_, filename: string, conceptName: string): Promise<void> => {
      return await this.ensureStorage().removeConceptFromIdea(filename, conceptName)
    })

    ipcMain.handle('ideas:linkNote', async (_, ideaFilename: string, noteFilename: string): Promise<void> => {
      return await this.ensureStorage().linkNoteToIdea(ideaFilename, noteFilename)
    })

    ipcMain.handle('ideas:removeNoteLink', async (_, ideaFilename: string, noteFilename: string): Promise<void> => {
      return await this.ensureStorage().removeNoteLinkFromIdea(ideaFilename, noteFilename)
    })

    ipcMain.handle('ideas:updateMetadata', async (_, filename: string, metadata: any): Promise<void> => {
      return await this.ensureStorage().updateIdeaMetadata(filename, metadata)
    })

    // ============================================================================
    // NOTES (Processed items with concepts)
    // ============================================================================

    ipcMain.handle('notes:list', async (): Promise<Note[]> => {
      return await this.ensureStorage().listNotes('notes')
    })

    ipcMain.handle('notes:load', async (_, filename: string): Promise<Note> => {
      return await this.ensureStorage().loadNote(filename)
    })

    ipcMain.handle('notes:save', async (_, filename: string, content: string, metadata: any): Promise<boolean> => {
      return await this.ensureStorage().saveNote(filename, content, metadata)
    })

    ipcMain.handle('notes:delete', async (_, filename: string): Promise<boolean> => {
      return await this.ensureStorage().deleteNote(filename)
    })

    ipcMain.handle('notes:rename', async (_, oldFilename: string, newFilename: string): Promise<boolean> => {
      return await this.ensureStorage().renameNote(oldFilename, newFilename)
    })


    // ============================================================================
    // CONCEPTS (Tags with backlinks)
    // ============================================================================

    ipcMain.handle('concepts:list', async (): Promise<Concept[]> => {
      return await this.ensureStorage().listConcepts()
    })

    ipcMain.handle('concepts:create', async (_, name: string, content: string, metadata?: any): Promise<boolean> => {
      await this.ensureStorage().saveConcept(name, content, {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        linkedNotes: [],
        relatedConcepts: [],
        ...metadata
      })
      return true
    })

    ipcMain.handle('concepts:load', async (_, name: string): Promise<Concept> => {
      return await this.ensureStorage().getConcept(name)
    })

    ipcMain.handle('concepts:save', async (_, name: string, content: string, metadata: any): Promise<boolean> => {
      return await this.ensureStorage().saveConcept(name, content, metadata)
    })

    ipcMain.handle('concepts:delete', async (_, name: string): Promise<boolean> => {
      return await this.ensureStorage().deleteConcept(name)
    })

    ipcMain.handle('concepts:getNotesFor', async (_, conceptName: string): Promise<string[]> => {
      return await this.ensureStorage().getNotesForConcept(conceptName)
    })

    ipcMain.handle('concepts:getForNote', async (_, filename: string): Promise<string[]> => {
      return await this.ensureStorage().getConceptsForNote(filename)
    })

    // Concept-to-concept relations
    ipcMain.handle('concepts:addRelation', async (_, fromConcept: string, toConcept: string): Promise<void> => {
      return await this.ensureStorage().relations.addConceptRelation(fromConcept, toConcept)
    })

    ipcMain.handle('concepts:removeRelation', async (_, fromConcept: string, toConcept: string): Promise<void> => {
      return await this.ensureStorage().relations.removeConceptRelation(fromConcept, toConcept)
    })

    // ============================================================================
    // MEDIA OPERATIONS
    // ============================================================================

    ipcMain.handle('media:save', async (_, filename: string, data: string | Buffer, mimeType?: string, noteFilename?: string) => {
      return await this.ensureStorage().saveMedia(filename, data, mimeType, noteFilename)
    })

    ipcMain.handle('media:load', async (_, filename: string) => {
      return await this.ensureStorage().loadMedia(filename)
    })

    ipcMain.handle('media:listForNote', async (_, noteFilename: string) => {
      return await this.ensureStorage().listMediaForNote(noteFilename)
    })

    ipcMain.handle('media:delete', async (_, filename: string) => {
      return await this.ensureStorage().deleteMedia(filename)
    })

    ipcMain.handle('media:listAll', async () => {
      return await this.ensureStorage().listAllMedia()
    })

    // ============================================================================
    // REFERENTIAL INTEGRITY
    // ============================================================================

    ipcMain.handle('integrity:validate', async () => {
      return await this.ensureStorage().validateAndRepairIntegrity()
    })

    ipcMain.handle('integrity:repair', async () => {
      return await this.ensureStorage().relations.repairRelations()
    })

    // ============================================================================
    // UNIFIED SEARCH
    // ============================================================================

    ipcMain.handle('search:all', async (_, query: string): Promise<{
      ideas: Idea[]
      notes: Note[]
      concepts: Concept[]
    }> => {
      const [ideas, notes, concepts] = await Promise.all([
        this.ensureStorage().listIdeas(),
        this.ensureStorage().listNotes('notes'), 
        this.ensureStorage().listConcepts()
      ])

      const queryLower = query.toLowerCase()

      return {
        ideas: ideas.filter(idea => 
          idea.content.toLowerCase().includes(queryLower)
        ),
        notes: notes.filter(note =>
          note.metadata.title?.toLowerCase().includes(queryLower) ||
          note.content.toLowerCase().includes(queryLower) ||
          note.metadata.concepts?.some(c => c.toLowerCase().includes(queryLower))
        ),
        concepts: concepts.filter(concept =>
          concept.name.toLowerCase().includes(queryLower) ||
          concept.content.toLowerCase().includes(queryLower)
        )
      }
    })

    ipcMain.handle('search:notes', async (_, query: string, options?: any) => {
      return await this.ensureStorage().searchNotes(query, options)
    })

    ipcMain.handle('content:parse', async (_, content: string) => {
      return this.ensureStorage().parseContent(content)
    })

    // ============================================================================
    // FILE MANAGEMENT UTILITIES
    // ============================================================================

    ipcMain.handle('files:checkUnique', async (_, filename: string, excludeFilename?: string) => {
      return await this.ensureStorage().checkFilenameUnique(filename, excludeFilename)
    })

    ipcMain.handle('files:exists', async (_, filename: string) => {
      return await this.ensureStorage().noteExists(filename)
    })

    // ============================================================================
    // RELATION MANAGEMENT
    // ============================================================================

    ipcMain.handle('relations:addNoteConcept', async (_, noteFilename: string, conceptName: string) => {
      return await this.ensureStorage().relations.addNoteConcept(noteFilename, conceptName)
    })

    ipcMain.handle('relations:removeNoteConcept', async (_, noteFilename: string, conceptName: string) => {
      return await this.ensureStorage().relations.removeNoteConcept(noteFilename, conceptName)
    })

    ipcMain.handle('relations:updateNoteConcepts', async (_, noteFilename: string, oldConcepts: string[], newConcepts: string[]) => {
      return await this.ensureStorage().relations.updateNoteConcepts(noteFilename, oldConcepts, newConcepts)
    })

    // Note-to-Note relations
    ipcMain.handle('relations:addNoteLink', async (_, fromNote: string, toNote: string) => {
      return await this.ensureStorage().relations.addNoteLink(fromNote, toNote)
    })

    ipcMain.handle('relations:removeNoteLink', async (_, fromNote: string, toNote: string) => {
      return await this.ensureStorage().relations.removeNoteLink(fromNote, toNote)
    })

    ipcMain.handle('relations:updateNoteLinks', async (_, noteFilename: string, oldLinks: string[], newLinks: string[]) => {
      return await this.ensureStorage().relations.updateNoteLinks(noteFilename, oldLinks, newLinks)
    })

    // Concept-to-Concept relations
    ipcMain.handle('relations:addConceptRelation', async (_, fromConcept: string, toConcept: string) => {
      return await this.ensureStorage().relations.addConceptRelation(fromConcept, toConcept)
    })

    ipcMain.handle('relations:removeConceptRelation', async (_, fromConcept: string, toConcept: string) => {
      return await this.ensureStorage().relations.removeConceptRelation(fromConcept, toConcept)
    })

    ipcMain.handle('relations:updateConceptRelations', async (_, conceptName: string, oldRelated: string[], newRelated: string[]) => {
      return await this.ensureStorage().relations.updateConceptRelations(conceptName, oldRelated, newRelated)
    })

    // Integrity validation and repair
    ipcMain.handle('relations:validateIntegrity', async () => {
      return await this.ensureStorage().relations.validateRelations()
    })

    ipcMain.handle('relations:repairIntegrity', async () => {
      return await this.ensureStorage().relations.repairRelations()
    })

    // ============================================================================
    // APP STATE MANAGEMENT
    // ============================================================================

    ipcMain.handle('app:getPinnedItems', async () => {
      return await this.ensureStorage().getPinnedItems()
    })

    ipcMain.handle('app:pinItem', async (_, type: 'note' | 'concept', name: string) => {
      return await this.ensureStorage().pinItem(type, name)
    })

    ipcMain.handle('app:unpinItem', async (_, type: 'note' | 'concept', name: string) => {
      return await this.ensureStorage().unpinItem(type, name)
    })

    ipcMain.handle('app:getRecentNotes', async (_, limit?: number) => {
      return await this.ensureStorage().getRecentNotes(limit)
    })

  }

  // Clean up handlers when shutting down
  public removeHandlers() {
    const handlers = [
      // Ideas
      'ideas:list', 'ideas:create', 'ideas:load', 'ideas:update', 'ideas:delete', 'ideas:rename', 'ideas:promote',
      'ideas:attachConcept', 'ideas:removeConcept', 'ideas:linkNote', 'ideas:removeNoteLink', 'ideas:updateMetadata',
      // Notes  
      'notes:list', 'notes:load', 'notes:save', 'notes:delete', 'notes:rename',
      // Concepts
      'concepts:list', 'concepts:create', 'concepts:load', 'concepts:save', 'concepts:delete', 'concepts:getNotesFor', 'concepts:getForNote',
      'concepts:addRelation', 'concepts:removeRelation',
      // Media
      'media:save', 'media:load', 'media:listForNote', 'media:delete', 'media:listAll',
      // System/Integrity
      'integrity:validate', 'integrity:repair',
      // Search
      'search:all', 'search:notes', 'content:parse',
      // File Management
      'files:checkUnique', 'files:exists',
      // Relations
      'relations:addNoteConcept', 'relations:removeNoteConcept', 'relations:updateNoteConcepts',
      'relations:addConceptRelation', 'relations:removeConceptRelation', 'relations:updateConceptRelations',
      // App state
      'app:getPinnedItems', 'app:pinItem', 'app:unpinItem', 'app:getRecentNotes'
    ]

    handlers.forEach(handler => {
      ipcMain.removeHandler(handler)
    })
  }
}