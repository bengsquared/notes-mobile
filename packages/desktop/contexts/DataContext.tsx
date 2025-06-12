'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import type { Note, Concept } from '@notes-app/shared'
import type { Idea } from '../src/lib/storage'
import { dataHandler } from '../src/lib/data-handler'

interface DataContextType {
  // State
  notes: Note[]
  concepts: Concept[]
  ideas: Idea[]
  pinnedItems: { notes: string[], concepts: string[] }
  recentNotes: Note[]
  loading: {
    notes: boolean
    concepts: boolean
    ideas: boolean
    pinned: boolean
    recent: boolean
  }

  // Actions
  loadNotes: () => Promise<void>
  loadConcepts: () => Promise<void>
  loadIdeas: () => Promise<void>
  loadPinnedItems: () => Promise<void>
  loadRecentNotes: (limit?: number) => Promise<void>
  
  // Note operations
  saveNote: (filename: string, content: string, metadata: any) => Promise<boolean>
  deleteNote: (filename: string) => Promise<boolean>
  renameNote: (oldFilename: string, newFilename: string) => Promise<boolean>
  
  // Concept operations
  saveConcept: (name: string, content: string, metadata: any) => Promise<boolean>
  createConcept: (name: string, content?: string, metadata?: any) => Promise<boolean>
  deleteConcept: (name: string) => Promise<boolean>
  
  // Idea operations
  saveIdea: (filename: string, content: string, metadata?: any) => Promise<Idea>
  promoteIdea: (filename: string, title: string, concepts?: string[]) => Promise<Note>
  deleteIdea: (filename: string) => Promise<void>
  renameIdea: (oldFilename: string, newFilename: string) => Promise<boolean>
  
  // Idea metadata operations for unified context
  attachConceptToIdea: (filename: string, conceptName: string) => Promise<void>
  removeConceptFromIdea: (filename: string, conceptName: string) => Promise<void>
  linkNoteToIdea: (ideaFilename: string, noteFilename: string) => Promise<void>
  removeNoteLinkFromIdea: (ideaFilename: string, noteFilename: string) => Promise<void>
  updateIdeaMetadata: (filename: string, metadata: any) => Promise<void>
  
  // Pin operations
  pinItem: (type: 'note' | 'concept', name: string) => Promise<boolean>
  unpinItem: (type: 'note' | 'concept', name: string) => Promise<boolean>
  
  // Utility functions
  getConceptNoteCount: (conceptName: string) => number
  getNotesForConcept: (conceptName: string) => Promise<string[]>
  getConceptsForNote: (filename: string) => Promise<string[]>
  
  // Relationship management
  addNoteConcept: (noteFilename: string, conceptName: string) => Promise<void>
  removeNoteConcept: (noteFilename: string, conceptName: string) => Promise<void>
  updateNoteConcepts: (noteFilename: string, oldConcepts: string[], newConcepts: string[]) => Promise<void>
  addConceptRelation: (fromConcept: string, toConcept: string) => Promise<void>
  removeConceptRelation: (fromConcept: string, toConcept: string) => Promise<void>
  
  // Search functions
  searchAll: (query: string) => Promise<{ ideas: Idea[], notes: Note[], concepts: Concept[] }>
  searchNotes: (query: string, options?: any) => Promise<Note[]>
  suggestConcepts: (noteContent: string) => Promise<string[]>
  getSimilarNotes: (filename: string) => Promise<Note[]>
  
  // Media operations
  saveMedia: (filename: string, data: string | Buffer, mimeType?: string, noteFilename?: string) => Promise<string>
  listMediaForNote: (noteFilename: string) => Promise<any[]>
  deleteMedia: (filename: string) => Promise<boolean>
  
  // Content operations
  parseContent: (content: string) => Promise<any>
  
  // File management
  checkFilenameUnique: (filename: string, excludeFilename?: string) => Promise<boolean>
  
  // Enhanced operations
  getKnowledgeOverview: () => Promise<any>
  getNoteRelationships: (filename: string) => Promise<any>
  getConceptRelationships: (conceptName: string) => Promise<any>
  
  // Unified item operations for context sidebar
  getUnifiedItem: (type: 'note' | 'idea', filename: string) => Promise<Note | Idea | null>
  attachConceptToItem: (type: 'note' | 'idea', filename: string, conceptName: string) => Promise<void>
  removeConceptFromItem: (type: 'note' | 'idea', filename: string, conceptName: string) => Promise<void>
  linkNoteToItem: (type: 'note' | 'idea', sourceFilename: string, targetFilename: string) => Promise<void>
  removeNoteLinkFromItem: (type: 'note' | 'idea', sourceFilename: string, targetFilename: string) => Promise<void>
}

const DataContext = createContext<DataContextType | undefined>(undefined)

interface DataProviderProps {
  children: ReactNode
}

export function DataProvider({ children }: DataProviderProps) {
  const [notes, setNotes] = useState<Note[]>([])
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [pinnedItems, setPinnedItems] = useState<{ notes: string[], concepts: string[] }>({ notes: [], concepts: [] })
  const [recentNotes, setRecentNotes] = useState<Note[]>([])
  
  const [loading, setLoading] = useState({
    notes: false,
    concepts: false,
    ideas: false,
    pinned: false,
    recent: false
  })

  // Load functions
  const loadNotes = useCallback(async () => {
    setLoading(prev => ({ ...prev, notes: true }))
    try {
      const data = await dataHandler.listNotes()
      setNotes(data)
    } catch (error) {
      console.error('Error loading notes:', error)
    } finally {
      setLoading(prev => ({ ...prev, notes: false }))
    }
  }, [])

  const loadConcepts = useCallback(async () => {
    setLoading(prev => ({ ...prev, concepts: true }))
    try {
      const data = await dataHandler.listConcepts()
      setConcepts(data)
    } catch (error) {
      console.error('Error loading concepts:', error)
    } finally {
      setLoading(prev => ({ ...prev, concepts: false }))
    }
  }, [])

  const loadIdeas = useCallback(async () => {
    setLoading(prev => ({ ...prev, ideas: true }))
    try {
      const data = await dataHandler.listIdeas()
      setIdeas(data)
    } catch (error) {
      console.error('Error loading ideas:', error)
    } finally {
      setLoading(prev => ({ ...prev, ideas: false }))
    }
  }, [])

  const loadPinnedItems = useCallback(async () => {
    setLoading(prev => ({ ...prev, pinned: true }))
    try {
      const data = await dataHandler.getPinnedItems()
      setPinnedItems(data)
    } catch (error) {
      console.error('Error loading pinned items:', error)
    } finally {
      setLoading(prev => ({ ...prev, pinned: false }))
    }
  }, [])

  const loadRecentNotes = useCallback(async (limit?: number) => {
    setLoading(prev => ({ ...prev, recent: true }))
    try {
      const data = await dataHandler.getRecentNotes(limit)
      setRecentNotes(data)
    } catch (error) {
      console.error('Error loading recent notes:', error)
    } finally {
      setLoading(prev => ({ ...prev, recent: false }))
    }
  }, [])

  // Note operations
  const saveNote = useCallback(async (filename: string, content: string, metadata: any) => {
    const success = await dataHandler.saveNote(filename, content, metadata)
    if (success) {
      await loadNotes()
      await loadRecentNotes()
    }
    return success
  }, [loadNotes, loadRecentNotes])

  const deleteNote = useCallback(async (filename: string) => {
    const success = await dataHandler.deleteNote(filename)
    if (success) {
      await loadNotes()
      await loadRecentNotes()
    }
    return success
  }, [loadNotes, loadRecentNotes])

  const renameNote = useCallback(async (oldFilename: string, newFilename: string) => {
    const success = await dataHandler.renameNote(oldFilename, newFilename)
    if (success) {
      await loadNotes()
      await loadRecentNotes()
    }
    return success
  }, [loadNotes, loadRecentNotes])

  // Concept operations
  const saveConcept = useCallback(async (name: string, content: string, metadata: any) => {
    const success = await dataHandler.saveConcept(name, content, metadata)
    if (success) {
      await loadConcepts()
    }
    return success
  }, [loadConcepts])

  const createConcept = useCallback(async (name: string, content?: string, metadata?: any) => {
    const defaultContent = content || `# ${name}\n\nA concept about ${name}.`
    const success = await dataHandler.createConcept(name, defaultContent, metadata)
    if (success) {
      await loadConcepts()
    }
    return success
  }, [loadConcepts])

  const deleteConcept = useCallback(async (name: string) => {
    const success = await dataHandler.deleteConcept(name)
    if (success) {
      await loadConcepts()
    }
    return success
  }, [loadConcepts])

  // Idea operations
  const saveIdea = useCallback(async (filename: string, content: string, metadata?: any) => {
    const idea = await dataHandler.updateIdea(filename, content, metadata)
    await loadIdeas()
    return idea
  }, [loadIdeas])

  const promoteIdea = useCallback(async (filename: string, title: string, concepts?: string[]) => {
    const note = await dataHandler.promoteIdea(filename, title, concepts)
    await loadIdeas()
    await loadNotes()
    return note
  }, [loadIdeas, loadNotes])

  const deleteIdea = useCallback(async (filename: string) => {
    await dataHandler.deleteIdea(filename)
    await loadIdeas()
  }, [loadIdeas])

  const renameIdea = useCallback(async (oldFilename: string, newFilename: string) => {
    const success = await dataHandler.renameIdea(oldFilename, newFilename) // Use dedicated idea rename method
    if (success) {
      await loadIdeas()
    }
    return success
  }, [loadIdeas])

  // Idea metadata operations for unified context
  const attachConceptToIdea = useCallback(async (filename: string, conceptName: string) => {
    await dataHandler.attachConceptToIdea(filename, conceptName)
    await loadIdeas()
    await loadConcepts() // Refresh concepts in case new one was created
  }, [loadIdeas, loadConcepts])

  const removeConceptFromIdea = useCallback(async (filename: string, conceptName: string) => {
    await dataHandler.removeConceptFromIdea(filename, conceptName)
    await loadIdeas()
    await loadConcepts() // Refresh concepts to update metadata and counts
  }, [loadIdeas, loadConcepts])

  const linkNoteToIdea = useCallback(async (ideaFilename: string, noteFilename: string) => {
    await dataHandler.linkNoteToIdea(ideaFilename, noteFilename)
    await loadIdeas()
  }, [loadIdeas])

  const removeNoteLinkFromIdea = useCallback(async (ideaFilename: string, noteFilename: string) => {
    await dataHandler.removeNoteLinkFromIdea(ideaFilename, noteFilename)
    await loadIdeas()
  }, [loadIdeas])

  const updateIdeaMetadata = useCallback(async (filename: string, metadata: any) => {
    await dataHandler.updateIdeaMetadata(filename, metadata)
    await loadIdeas()
  }, [loadIdeas])

  // Pin operations
  const pinItem = useCallback(async (type: 'note' | 'concept', name: string) => {
    const success = await dataHandler.pinItem(type, name)
    if (success) {
      await loadPinnedItems()
    }
    return success
  }, [loadPinnedItems])

  const unpinItem = useCallback(async (type: 'note' | 'concept', name: string) => {
    const success = await dataHandler.unpinItem(type, name)
    if (success) {
      await loadPinnedItems()
    }
    return success
  }, [loadPinnedItems])

  // Utility functions
  const getConceptNoteCount = useCallback((conceptName: string) => {
    return notes.filter(note => 
      note.metadata.concepts?.includes(conceptName)
    ).length
  }, [notes])

  const getNotesForConcept = useCallback(async (conceptName: string) => {
    return await dataHandler.getNotesForConcept(conceptName)
  }, [])

  const getConceptsForNote = useCallback(async (filename: string) => {
    return await dataHandler.getConceptsForNote(filename)
  }, [])

  // Search functions
  const searchAll = useCallback(async (query: string) => {
    return await dataHandler.searchAll(query)
  }, [])

  const suggestConcepts = useCallback(async (noteContent: string) => {
    return await dataHandler.suggestConcepts(noteContent)
  }, [])

  const getSimilarNotes = useCallback(async (filename: string) => {
    return await dataHandler.findSimilarNotes(filename)
  }, [])

  // New enhanced functions
  const searchNotes = useCallback(async (query: string, options?: any) => {
    return await dataHandler.searchNotes(query, options)
  }, [])

  const saveMedia = useCallback(async (filename: string, data: string | Buffer, mimeType?: string, noteFilename?: string) => {
    return await dataHandler.saveMedia(filename, data, mimeType, noteFilename)
  }, [])

  const listMediaForNote = useCallback(async (noteFilename: string) => {
    return await dataHandler.listMediaForNote(noteFilename)
  }, [])

  const deleteMedia = useCallback(async (filename: string) => {
    return await dataHandler.deleteMedia(filename)
  }, [])

  const parseContent = useCallback(async (content: string) => {
    return await dataHandler.parseContent(content)
  }, [])

  const checkFilenameUnique = useCallback(async (filename: string, excludeFilename?: string) => {
    return await dataHandler.checkFilenameUnique(filename, excludeFilename)
  }, [])

  const getKnowledgeOverview = useCallback(async () => {
    return await dataHandler.getKnowledgeOverview()
  }, [])

  const getNoteRelationships = useCallback(async (filename: string) => {
    return await dataHandler.getNoteRelationships(filename)
  }, [])

  const getConceptRelationships = useCallback(async (conceptName: string) => {
    return await dataHandler.getConceptRelationships(conceptName)
  }, [])

  // Relationship management methods - DEFINED FIRST
  const addNoteConcept = useCallback(async (noteFilename: string, conceptName: string) => {
    console.log("in Data Context, connect", noteFilename, conceptName)
    await dataHandler.addNoteConcept(noteFilename, conceptName)
    // Refresh data to reflect relationship changes
    await loadNotes()
    await loadConcepts()
  }, [loadNotes, loadConcepts])

  const removeNoteConcept = useCallback(async (noteFilename: string, conceptName: string) => {
    await dataHandler.removeNoteConcept(noteFilename, conceptName)
    // Refresh data to reflect relationship changes
    await loadNotes()
    await loadConcepts()
  }, [loadNotes, loadConcepts])

  const updateNoteConcepts = useCallback(async (noteFilename: string, oldConcepts: string[], newConcepts: string[]) => {
    await dataHandler.updateNoteConcepts(noteFilename, oldConcepts, newConcepts)
    // Refresh data to reflect relationship changes
    await loadNotes()
    await loadConcepts()
  }, [loadNotes, loadConcepts])

  const addConceptRelation = useCallback(async (fromConcept: string, toConcept: string) => {
    await dataHandler.addConceptRelation(fromConcept, toConcept)
    // Refresh concepts to reflect relationship changes
    await loadConcepts()
  }, [loadConcepts])

  const removeConceptRelation = useCallback(async (fromConcept: string, toConcept: string) => {
    await dataHandler.removeConceptRelation(fromConcept, toConcept)
    // Refresh concepts to reflect relationship changes
    await loadConcepts()
  }, [loadConcepts])

  // Unified item operations for context sidebar - DEFINED AFTER
  const getUnifiedItem = useCallback(async (type: 'note' | 'idea', filename: string): Promise<Note | Idea | null> => {
    try {
      if (type === 'note') {
        return await dataHandler.loadNote(filename)
      } else {
        return await dataHandler.loadIdea(filename)
      }
    } catch (error) {
      console.error(`Error loading ${type} ${filename}:`, error)
      return null
    }
  }, [])

  const attachConceptToItem = useCallback(async (type: 'note' | 'idea', filename: string, conceptName: string) => {
    if (type === 'note') {
      await addNoteConcept(filename, conceptName)
    } else {
      await attachConceptToIdea(filename, conceptName)
    }
  }, [addNoteConcept, attachConceptToIdea])

  const removeConceptFromItem = useCallback(async (type: 'note' | 'idea', filename: string, conceptName: string) => {
    if (type === 'note') {
      await removeNoteConcept(filename, conceptName)
    } else {
      await removeConceptFromIdea(filename, conceptName)
    }
  }, [removeNoteConcept, removeConceptFromIdea])

  const linkNoteToItem = useCallback(async (type: 'note' | 'idea', sourceFilename: string, targetFilename: string) => {
    if (type === 'note') {
      // For notes, use bidirectional note linking
      await dataHandler.addNoteLink(sourceFilename, targetFilename)
      await loadNotes()
    } else {
      // For ideas, use unidirectional linking
      await linkNoteToIdea(sourceFilename, targetFilename)
    }
  }, [loadNotes, linkNoteToIdea])

  const removeNoteLinkFromItem = useCallback(async (type: 'note' | 'idea', sourceFilename: string, targetFilename: string) => {
    if (type === 'note') {
      // For notes, remove bidirectional link
      await dataHandler.removeNoteLink(sourceFilename, targetFilename)
      await loadNotes()
    } else {
      // For ideas, remove unidirectional link
      await removeNoteLinkFromIdea(sourceFilename, targetFilename)
    }
  }, [loadNotes, removeNoteLinkFromIdea])

  // Load initial data
  useEffect(() => {
    loadNotes()
    loadConcepts()
    loadIdeas()
    loadPinnedItems()
    loadRecentNotes()
  }, [loadNotes, loadConcepts, loadIdeas, loadPinnedItems, loadRecentNotes])

  const value: DataContextType = {
    // State
    notes,
    concepts,
    ideas,
    pinnedItems,
    recentNotes,
    loading,

    // Actions
    loadNotes,
    loadConcepts,
    loadIdeas,
    loadPinnedItems,
    loadRecentNotes,

    // Operations
    saveNote,
    deleteNote,
    renameNote,
    saveConcept,
    createConcept,
    deleteConcept,
    saveIdea,
    promoteIdea,
    deleteIdea,
    renameIdea,
    attachConceptToIdea,
    removeConceptFromIdea,
    linkNoteToIdea,
    removeNoteLinkFromIdea,
    updateIdeaMetadata,
    pinItem,
    unpinItem,

    // Utilities
    getConceptNoteCount,
    getNotesForConcept,
    getConceptsForNote,
    
    // Relationship management
    addNoteConcept,
    removeNoteConcept,
    updateNoteConcepts,
    addConceptRelation,
    removeConceptRelation,
    
    // Search
    searchAll,
    searchNotes,
    suggestConcepts,
    getSimilarNotes,
    
    // Media operations
    saveMedia,
    listMediaForNote,
    deleteMedia,
    
    // Content operations
    parseContent,
    
    // File management
    checkFilenameUnique,
    
    // Enhanced operations
    getKnowledgeOverview,
    getNoteRelationships,
    getConceptRelationships,
    
    // Unified operations
    getUnifiedItem,
    attachConceptToItem,
    removeConceptFromItem,
    linkNoteToItem,
    removeNoteLinkFromItem
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}

// Convenience hooks for specific data types
export function useNotes() {
  const { notes, loading, loadNotes, saveNote, deleteNote, renameNote } = useData()
  return { notes, loading: loading.notes, loadNotes, saveNote, deleteNote, renameNote }
}

export function useConcepts() {
  const { concepts, loading, loadConcepts, saveConcept, createConcept, deleteConcept, getConceptNoteCount } = useData()
  return { concepts, loading: loading.concepts, loadConcepts, saveConcept, createConcept, deleteConcept, getConceptNoteCount }
}

export function useIdeas() {
  const { 
    ideas, loading, loadIdeas, saveIdea, promoteIdea, deleteIdea, renameIdea,
    attachConceptToIdea, removeConceptFromIdea, linkNoteToIdea, removeNoteLinkFromIdea, updateIdeaMetadata
  } = useData()
  return { 
    ideas, loading: loading.ideas, loadIdeas, saveIdea, promoteIdea, deleteIdea, renameIdea,
    attachConceptToIdea, removeConceptFromIdea, linkNoteToIdea, removeNoteLinkFromIdea, updateIdeaMetadata
  }
}

export function usePinnedItems() {
  const { pinnedItems, loading, loadPinnedItems, pinItem, unpinItem } = useData()
  return { pinnedItems, loading: loading.pinned, loadPinnedItems, pinItem, unpinItem }
}

export function useRecentNotes() {
  const { recentNotes, loading, loadRecentNotes } = useData()
  return { recentNotes, loading: loading.recent, loadRecentNotes }
}

// Unified hook for context sidebar use
export function useUnifiedContext() {
  const {
    concepts, notes, loading,
    getUnifiedItem, attachConceptToItem, removeConceptFromItem,
    linkNoteToItem, removeNoteLinkFromItem,
    suggestConcepts, getSimilarNotes, createConcept,
    addConceptRelation, removeConceptRelation
  } = useData()
  
  return {
    concepts,
    notes,
    loading,
    getUnifiedItem,
    attachConceptToItem,
    removeConceptFromItem,
    linkNoteToItem,
    removeNoteLinkFromItem,
    suggestConcepts,
    getSimilarNotes,
    createConcept,
    addConceptRelation,
    removeConceptRelation
  }
}