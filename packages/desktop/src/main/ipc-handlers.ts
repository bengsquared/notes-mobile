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
  private storage: NotesStorage

  constructor(storage: NotesStorage) {
    this.storage = storage
    this.registerHandlers()
  }

  private registerHandlers() {
    // ============================================================================
    // IDEAS (Draft thoughts, unprocessed)
    // ============================================================================

    ipcMain.handle('ideas:list', async (): Promise<Idea[]> => {
      return await this.storage.listIdeas()
    })

    ipcMain.handle('ideas:create', async (_, content: string, metadata?: any): Promise<Idea> => {
      return await this.storage.createIdea(content, metadata)
    })

    ipcMain.handle('ideas:load', async (_, filename: string): Promise<Idea> => {
      return await this.storage.loadIdea(filename)
    })

    ipcMain.handle('ideas:update', async (_, filename: string, content: string, metadata?: any): Promise<Idea> => {
      return await this.storage.updateIdea(filename, content, metadata)
    })

    ipcMain.handle('ideas:delete', async (_, filename: string): Promise<void> => {
      return await this.storage.deleteIdea(filename)
    })

    ipcMain.handle('ideas:rename', async (_, oldFilename: string, newFilename: string): Promise<boolean> => {
      return await this.storage.renameNote(oldFilename, newFilename)
    })

    ipcMain.handle('ideas:promote', async (_, ideaFilename: string, title: string, concepts?: string[]): Promise<Note> => {
      return await this.storage.promoteIdeaToNote(ideaFilename, title, concepts)
    })

    // Idea metadata operations for unified context sidebar
    ipcMain.handle('ideas:attachConcept', async (_, filename: string, conceptName: string): Promise<void> => {
      return await this.storage.attachConceptToIdea(filename, conceptName)
    })

    ipcMain.handle('ideas:removeConcept', async (_, filename: string, conceptName: string): Promise<void> => {
      return await this.storage.removeConceptFromIdea(filename, conceptName)
    })

    ipcMain.handle('ideas:linkNote', async (_, ideaFilename: string, noteFilename: string): Promise<void> => {
      return await this.storage.linkNoteToIdea(ideaFilename, noteFilename)
    })

    ipcMain.handle('ideas:removeNoteLink', async (_, ideaFilename: string, noteFilename: string): Promise<void> => {
      return await this.storage.removeNoteLinkFromIdea(ideaFilename, noteFilename)
    })

    ipcMain.handle('ideas:updateMetadata', async (_, filename: string, metadata: any): Promise<void> => {
      return await this.storage.updateIdeaMetadata(filename, metadata)
    })

    // ============================================================================
    // NOTES (Processed items with concepts)
    // ============================================================================

    ipcMain.handle('notes:list', async (): Promise<Note[]> => {
      return await this.storage.listNotes('notes')
    })

    ipcMain.handle('notes:load', async (_, filename: string): Promise<Note> => {
      return await this.storage.loadNote(filename)
    })

    ipcMain.handle('notes:save', async (_, filename: string, content: string, metadata: any): Promise<boolean> => {
      return await this.storage.saveNote(filename, content, metadata)
    })

    ipcMain.handle('notes:delete', async (_, filename: string): Promise<boolean> => {
      return await this.storage.deleteNote(filename)
    })

    ipcMain.handle('notes:rename', async (_, oldFilename: string, newFilename: string): Promise<boolean> => {
      return await this.storage.renameNote(oldFilename, newFilename)
    })


    // ============================================================================
    // CONCEPTS (Tags with backlinks)
    // ============================================================================

    ipcMain.handle('concepts:list', async (): Promise<Concept[]> => {
      return await this.storage.listConcepts()
    })

    ipcMain.handle('concepts:create', async (_, name: string, content: string, metadata?: any): Promise<boolean> => {
      await this.storage.saveConcept(name, content, {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        linkedNotes: [],
        relatedConcepts: [],
        ...metadata
      })
      return true
    })

    ipcMain.handle('concepts:load', async (_, name: string): Promise<Concept> => {
      return await this.storage.getConcept(name)
    })

    ipcMain.handle('concepts:save', async (_, name: string, content: string, metadata: any): Promise<boolean> => {
      return await this.storage.saveConcept(name, content, metadata)
    })

    ipcMain.handle('concepts:delete', async (_, name: string): Promise<boolean> => {
      return await this.storage.deleteConcept(name)
    })

    ipcMain.handle('concepts:getNotesFor', async (_, conceptName: string): Promise<string[]> => {
      return await this.storage.getNotesForConcept(conceptName)
    })

    ipcMain.handle('concepts:getForNote', async (_, filename: string): Promise<string[]> => {
      return await this.storage.getConceptsForNote(filename)
    })

    // Concept-to-concept relations
    ipcMain.handle('concepts:addRelation', async (_, fromConcept: string, toConcept: string): Promise<void> => {
      return await this.storage.relations.addConceptRelation(fromConcept, toConcept)
    })

    ipcMain.handle('concepts:removeRelation', async (_, fromConcept: string, toConcept: string): Promise<void> => {
      return await this.storage.relations.removeConceptRelation(fromConcept, toConcept)
    })

    // ============================================================================
    // MEDIA OPERATIONS
    // ============================================================================

    ipcMain.handle('media:save', async (_, filename: string, data: string | Buffer, mimeType?: string, noteFilename?: string) => {
      return await this.storage.saveMedia(filename, data, mimeType, noteFilename)
    })

    ipcMain.handle('media:load', async (_, filename: string) => {
      return await this.storage.loadMedia(filename)
    })

    ipcMain.handle('media:listForNote', async (_, noteFilename: string) => {
      return await this.storage.listMediaForNote(noteFilename)
    })

    ipcMain.handle('media:delete', async (_, filename: string) => {
      return await this.storage.deleteMedia(filename)
    })

    ipcMain.handle('media:listAll', async () => {
      return await this.storage.listAllMedia()
    })

    // ============================================================================
    // REFERENTIAL INTEGRITY
    // ============================================================================

    ipcMain.handle('integrity:validate', async () => {
      return await this.storage.validateAndRepairIntegrity()
    })

    ipcMain.handle('integrity:repair', async () => {
      return await this.storage.relations.repairRelations()
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
        this.storage.listIdeas(),
        this.storage.listNotes('notes'), 
        this.storage.listConcepts()
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
      return await this.storage.searchNotes(query, options)
    })

    ipcMain.handle('content:parse', async (_, content: string) => {
      return this.storage.parseContent(content)
    })

    // ============================================================================
    // FILE MANAGEMENT UTILITIES
    // ============================================================================

    ipcMain.handle('files:checkUnique', async (_, filename: string, excludeFilename?: string) => {
      return await this.storage.checkFilenameUnique(filename, excludeFilename)
    })

    ipcMain.handle('files:exists', async (_, filename: string) => {
      return await this.storage.noteExists(filename)
    })

    // ============================================================================
    // RELATION MANAGEMENT
    // ============================================================================

    ipcMain.handle('relations:addNoteConcept', async (_, noteFilename: string, conceptName: string) => {
      return await this.storage.relations.addNoteConcept(noteFilename, conceptName)
    })

    ipcMain.handle('relations:removeNoteConcept', async (_, noteFilename: string, conceptName: string) => {
      return await this.storage.relations.removeNoteConcept(noteFilename, conceptName)
    })

    ipcMain.handle('relations:updateNoteConcepts', async (_, noteFilename: string, oldConcepts: string[], newConcepts: string[]) => {
      return await this.storage.relations.updateNoteConcepts(noteFilename, oldConcepts, newConcepts)
    })

    // Note-to-Note relations
    ipcMain.handle('relations:addNoteLink', async (_, fromNote: string, toNote: string) => {
      return await this.storage.relations.addNoteLink(fromNote, toNote)
    })

    ipcMain.handle('relations:removeNoteLink', async (_, fromNote: string, toNote: string) => {
      return await this.storage.relations.removeNoteLink(fromNote, toNote)
    })

    ipcMain.handle('relations:updateNoteLinks', async (_, noteFilename: string, oldLinks: string[], newLinks: string[]) => {
      return await this.storage.relations.updateNoteLinks(noteFilename, oldLinks, newLinks)
    })

    // Concept-to-Concept relations
    ipcMain.handle('relations:addConceptRelation', async (_, fromConcept: string, toConcept: string) => {
      return await this.storage.relations.addConceptRelation(fromConcept, toConcept)
    })

    ipcMain.handle('relations:removeConceptRelation', async (_, fromConcept: string, toConcept: string) => {
      return await this.storage.relations.removeConceptRelation(fromConcept, toConcept)
    })

    ipcMain.handle('relations:updateConceptRelations', async (_, conceptName: string, oldRelated: string[], newRelated: string[]) => {
      return await this.storage.relations.updateConceptRelations(conceptName, oldRelated, newRelated)
    })

    // Integrity validation and repair
    ipcMain.handle('relations:validateIntegrity', async () => {
      return await this.storage.relations.validateRelations()
    })

    ipcMain.handle('relations:repairIntegrity', async () => {
      return await this.storage.relations.repairRelations()
    })

    // ============================================================================
    // APP STATE MANAGEMENT
    // ============================================================================

    ipcMain.handle('app:getPinnedItems', async () => {
      return await this.storage.getPinnedItems()
    })

    ipcMain.handle('app:pinItem', async (_, type: 'note' | 'concept', name: string) => {
      return await this.storage.pinItem(type, name)
    })

    ipcMain.handle('app:unpinItem', async (_, type: 'note' | 'concept', name: string) => {
      return await this.storage.unpinItem(type, name)
    })

    ipcMain.handle('app:getRecentNotes', async (_, limit?: number) => {
      return await this.storage.getRecentNotes(limit)
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