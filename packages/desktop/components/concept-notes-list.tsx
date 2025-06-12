'use client'

import { useState, useEffect, useMemo } from 'react'
import { ArrowLeft, Hash, X } from 'lucide-react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { LoadingState } from './ui/loading-state'
import { EmptyState } from './ui/empty-state'
import { LinkSearch, notesToSearchItems } from './link-search'
import { useNoteSearch } from '../hooks/use-search'
import { useErrorHandler } from '@notes-app/shared'
import { ErrorAlert } from './ui/error-alert'
import { formatDate } from '../utils/date'
import { useData } from '../contexts/DataContext'
import type { Note } from '@notes-app/shared'
import type { LayoutState } from './main-layout'

interface ConceptNotesListProps {
  conceptName: string
  onBack: () => void
  onNoteSelect: (noteFilename: string) => void
  onStateChange: (state: LayoutState) => void
}

export function ConceptNotesList({ conceptName, onBack, onNoteSelect, onStateChange }: ConceptNotesListProps) {
  const [conceptNotes, setConceptNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddNoteSearch, setShowAddNoteSearch] = useState(false)
  
  // Error handling
  const { error, handleError, clearError } = useErrorHandler()
  
  // Data from provider
  const { notes, saveNote, getNotesForConcept, addNoteConcept, removeNoteConcept } = useData()
  
  // Filter notes that don't already have this concept
  const filteredAvailableNotes = useMemo(() => {
    // Filter out inbox notes, transferred notes, and notes that already have this concept
    const processedNotes = notes.filter(note => {
      const isInboxNote = note.filename.includes('inbox/') || !note.metadata.title
      const isTransferredNote = note.filename.startsWith('transferred-')
      const hasNoConcepts = !note.metadata.concepts || note.metadata.concepts.length === 0
      const hasThisConcept = note.metadata.concepts?.includes(conceptName)
      
      return !isInboxNote && !isTransferredNote && !hasNoConcepts && !hasThisConcept
    })
    
    return processedNotes
  }, [notes, conceptName])
  
  // Search for notes to add to this concept
  const addNoteSearch = useNoteSearch(filteredAvailableNotes)

  useEffect(() => {
    loadNotesForConcept()
  }, [conceptName])

  const loadNotesForConcept = async () => {
    setLoading(true)
    try {
      const noteFilenames = await getNotesForConcept(conceptName)
      if (noteFilenames.length > 0) {
        const notesData = await Promise.all(
          noteFilenames.map(filename => window.electronAPI.notes.load(filename))
        )
        setConceptNotes(notesData.sort((a, b) => 
          new Date(b.metadata.modified || b.metadata.created || '').getTime() - 
          new Date(a.metadata.modified || a.metadata.created || '').getTime()
        ))
      } else {
        setConceptNotes([])
      }
    } catch (error) {
      console.error('Error loading notes for concept:', error)
    } finally {
      setLoading(false)
    }
  }


  const addNoteToConcept = async (note: Note) => {
    try {
      clearError()
      console.log('📌 Adding note to concept using relationship management:', note.metadata.title || note.filename, '→', conceptName)
      
      // Use the proper relationship management method
      await addNoteConcept(note.filename, conceptName)
      
      // Clear search and hide
      addNoteSearch.clearSearch()
      setShowAddNoteSearch(false)
      
      // Reload the notes list to update filtering
      await loadNotesForConcept()
      console.log('📌 Note added to concept successfully')
    } catch (err) {
      console.error(`❌ Failed to add note to concept:`, err)
      handleError(err, 'Failed to add note to concept')
    }
  }

  const removeNoteFromConcept = async (note: Note, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent note click when clicking remove
    
    try {
      clearError()
      console.log('📌 Removing note from concept:', note.metadata.title || note.filename, '←', conceptName)
      
      // Use the proper relationship management method
      await removeNoteConcept(note.filename, conceptName)
      
      // Reload the notes list
      await loadNotesForConcept()
      console.log('📌 Note removed from concept successfully')
    } catch (err) {
      console.error(`❌ Failed to remove note from concept:`, err)
      handleError(err, 'Failed to remove note from concept')
    }
  }

  const handleNoteClick = (note: Note) => {
    onNoteSelect(note.filename)
  }


  const getNoteConcepts = (note: Note) => {
    return note.metadata.concepts?.filter(c => c !== conceptName) || []
  }

  if (loading) {
    return <LoadingState message="Loading notes..." />
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button variant="ghost" size="sm" onClick={onBack} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center text-foreground">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 mr-3">
                  <Hash className="h-4 w-4 text-primary" />
                </div>
                {conceptName}
              </h1>
              <div className="text-sm text-muted-foreground mt-1 ml-11">
                {conceptNotes.length} {conceptNotes.length === 1 ? 'note' : 'notes'} tagged
              </div>
            </div>
          </div>
        </div>
        
        {/* Add Note Search */}
        <LinkSearch
          title="Add Notes"
          placeholder="Search notes to tag with this concept..."
          searchQuery={addNoteSearch.query}
          onSearchChange={addNoteSearch.setQuery}
          isOpen={showAddNoteSearch}
          onToggle={() => setShowAddNoteSearch(!showAddNoteSearch)}
          items={notesToSearchItems(addNoteSearch.filteredItems)}
          onItemSelect={(item) => {
            const note = filteredAvailableNotes.find(n => n.filename === item.id)
            if (note) addNoteToConcept(note)
          }}
          emptyMessage="No notes found"
        />
      </div>
      
      {/* Error Alert */}
      <ErrorAlert message={error.message} className="m-4 mb-0" />

      {/* Notes list */}
      <ScrollArea className="flex-1">
        {conceptNotes.length > 0 ? (
          <div className="p-4">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1.5fr_1fr_auto] gap-4 pb-2 mb-4 border-b text-sm font-medium text-muted-foreground">
              <div>Note</div>
              <div>Concepts</div>
              <div>Date</div>
              <div className="w-16 text-center">Actions</div>
            </div>

            {/* Notes rows */}
            <div className="space-y-1">
              {conceptNotes.map((note) => (
                <div
                  key={note.filename}
                  className="grid grid-cols-[2fr_1.5fr_1fr_auto] gap-4 p-3 hover:bg-muted/50 rounded-lg group"
                >
                  {/* Note title/filename - clickable */}
                  <div 
                    className="cursor-pointer min-w-0"
                    onClick={() => handleNoteClick(note)}
                  >
                    <div className="font-medium truncate">
                      {note.metadata.title || note.filename.replace('.txt', '')}
                    </div>
                    {note.metadata.title && (
                      <div className="text-xs text-muted-foreground truncate">
                        {note.filename}
                      </div>
                    )}
                  </div>

                  {/* Other concepts */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-1">
                      {getNoteConcepts(note).slice(0, 2).map((concept) => (
                        <span
                          key={concept}
                          className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs cursor-pointer hover:bg-muted/80 truncate"
                          onClick={(e) => {
                            e.stopPropagation()
                            onStateChange({
                              view: 'concept-editor',
                              selectedConcept: concept,
                              selectedNote: undefined,
                              inboxCount: 0
                            })
                          }}
                        >
                          #{concept}
                        </span>
                      ))}
                      {getNoteConcepts(note).length > 2 && (
                        <span className="text-xs text-muted-foreground">
                          +{getNoteConcepts(note).length - 2}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-sm text-muted-foreground flex items-center min-w-0">
                    <span className="truncate">
                      {formatDate(note.metadata.modified || note.metadata.created)}
                    </span>
                  </div>

                  {/* Remove button */}
                  <div className="flex items-center justify-center w-16">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => removeNoteFromConcept(note, e)}
                      aria-label={`Remove ${note.metadata.title || note.filename} from ${conceptName} concept`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Hash}
            title="No notes found"
            description={`No notes are tagged with the concept "${conceptName}"`}
          />
        )}
      </ScrollArea>
    </div>
  )
}