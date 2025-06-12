'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Trash2, SkipForward, Check, Smartphone, Copy, Undo, Redo, AlertCircle } from 'lucide-react'
import { useUndoRedo, useAutosave } from '@notes-app/shared'
import { titleToFilename } from '../utils/filename'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Input } from './ui/input'
import { Alert, AlertDescription } from './ui/alert'
import type { Note } from '@notes-app/shared'
import type { LayoutState } from './main-layout'
import { useIdeas, useData } from '../contexts/DataContext'

interface InboxProcessorProps {
  layoutState: LayoutState
  onStateChange: (state: LayoutState) => void
}

interface InboxNoteState {
  title: string
  content: string
  selectedConcepts: string[]
}

export function InboxProcessor({ layoutState, onStateChange }: InboxProcessorProps) {
  // Use ideas from DataContext directly instead of local state
  const currentIndex = layoutState.inboxCurrentIndex ?? 0
  const [loading, setLoading] = useState(true)
  const [transferPin, setTransferPin] = useState<string | null>(null)
  const [generatePinLoading, setGeneratePinLoading] = useState(false)
  const [filenameError, setFilenameError] = useState<string | null>(null)
  const [isValidatingFilename, setIsValidatingFilename] = useState(false)
  const [processingTitle, setProcessingTitle] = useState(false)
  
  // Use DataContext for all idea operations
  const { 
    ideas,
    loadIdeas,
    saveIdea, 
    renameIdea,
    promoteIdea,
    deleteIdea,
    attachConceptToIdea, 
    removeConceptFromIdea, 
    linkNoteToIdea, 
    removeNoteLinkFromIdea 
  } = useIdeas()
  const { loadNotes, checkFilenameUnique } = useData()
  
  // Undo/redo functionality - single source of truth
  const {
    state: noteState,
    set: setNoteState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory
  } = useUndoRedo<InboxNoteState>({
    title: '',
    content: '',
    selectedConcepts: []
  })

  // Load ideas on mount
  useEffect(() => {
    loadInboxNotes()
  }, [])

  // Get current note - handle empty inbox case
  const currentNote = ideas.length > 0 && currentIndex >= 0 && currentIndex < ideas.length ? ideas[currentIndex] : null
  
  // Update note state when current idea changes
  useEffect(() => {
    if (currentNote) {
      const newState = {
        title: currentNote.metadata.title || '',
        content: currentNote.content,
        selectedConcepts: currentNote.metadata.concepts || []
      }
      resetHistory(newState)
      
      // Clear any filename errors when switching notes
      setFilenameError(null)
      setIsValidatingFilename(false)
    }
  }, [currentIndex, resetHistory])
  
  // Separate effect for filename changes (renames) - only update if not processing
  useEffect(() => {
    if (currentNote && !processingTitle) {
      // Only update the editor state if we're not in the middle of processing a title
      // This prevents the title from reverting after a successful rename
      const currentEditorTitle = noteState.title
      const actualTitle = currentNote.metadata.title || ''
      
      // Only reset if the titles are significantly different (not just a rename in progress)
      if (actualTitle !== currentEditorTitle && !processingTitle) {
        setNoteState(prev => ({ 
          ...prev, 
          title: actualTitle,
          selectedConcepts: currentNote.metadata.concepts || []
        }))
      }
    }
  }, [currentNote?.filename, currentNote?.metadata.title, processingTitle])

  // Note: DataContext ideas are synced with layout state in main-layout.tsx

  // Define refs early
  const prevIndexRef = useRef(currentIndex)
  const currentNoteRef = useRef<Note | null>(null)
  const noteStateRef = useRef(noteState)

  const handleTitleChange = (newTitle: string) => {
    setNoteState(prev => ({ ...prev, title: newTitle }))
    // Clear filename error when user starts typing
    if (filenameError) {
      setFilenameError(null)
    }
  }

  const handleTitleBlur = async () => {
    // Process title changes (including rename) only on blur
    setProcessingTitle(true)
    try {
      await processTitleChange(noteState.title)
    } finally {
      setProcessingTitle(false)
    }
  }

  const handleContentChange = (newContent: string) => {
    setNoteState(prev => ({ ...prev, content: newContent }))
  }

  // Update noteStateRef
  noteStateRef.current = noteState

  const handleConceptSelect = (conceptName: string) => {
    console.log('📌 Concept selected:', conceptName)
    if (noteState.selectedConcepts.includes(conceptName)) {
      console.log('📌 Concept already selected, skipping')
      return
    }
    setNoteState(prev => ({
      ...prev,
      selectedConcepts: [...prev.selectedConcepts, conceptName]
    }))
  }

  const handleConceptDeselect = (conceptName: string) => {
    console.log('📌 Concept deselected:', conceptName)
    setNoteState(prev => ({
      ...prev,
      selectedConcepts: prev.selectedConcepts.filter(c => c !== conceptName)
    }))
  }

  // Note: The unified context sidebar will handle its own concept management
  // These handlers are kept for the concept chips display in the main panel
  
  // Callback to sync unified context sidebar changes with local state
  const handleItemChange = (updatedItem: Note) => {
    setNoteState(prev => ({
      ...prev,
      selectedConcepts: updatedItem.metadata.concepts || []
    }))
  }

  const handleNoteLink = (noteToLink: Note) => {
    console.log('🔗 handleNoteLink called with note:', noteToLink.metadata.title || noteToLink.filename)
    
    // For inbox processing, we just want to reference the note
    // This could be used to insert a reference into the content
    // For now, let's just log it - you can expand this functionality later
    console.log('🔗 Note link functionality can be expanded here')
  }

  const loadInboxNotes = async () => {
    try {
      setLoading(true)
      await loadIdeas() // DataContext will update the ideas state
      console.log('📥 Loaded ideas via DataContext')
      setLoading(false)
    } catch (error) {
      console.error('❌ Error loading inbox notes:', error)
      setLoading(false)
    }
  }

  currentNoteRef.current = currentNote

  // Content-only autosave function (no title processing)
  const saveContentOnly = useCallback(async (ideaState: InboxNoteState) => {
    if (!currentNote) return
    
    try {
      // Only save content changes, keep existing title
      const hasContentChanged = ideaState.content !== currentNote.content
      
      if (hasContentChanged) {
        // Keep existing metadata, don't change title
        const updatedMetadata = {
          ...currentNote.metadata
        }
        
        // Save content using DataContext - no renaming
        await saveIdea(currentNote.filename, ideaState.content, updatedMetadata)
      }
    } catch (error) {
      console.error('Error auto-saving content:', error)
    }
  }, [currentNote, saveIdea])

  // Title processing function (called on blur)
  const processTitleChange = useCallback(async (newTitle: string) => {
    if (!currentNote) return
    
    try {
      const hasTitleChanged = newTitle !== (currentNote.metadata.title || '')
      
      if (hasTitleChanged) {
        // Update metadata with new title
        const updatedMetadata = {
          ...currentNote.metadata,
          title: newTitle
        }
        
        // Check if we need to rename the file based on title changes
        let newFilename = currentNote.filename
        
        // Only rename if there's a meaningful title and it would create a different filename
        if (newTitle && newTitle.trim()) {
          const proposedFilename = titleToFilename(newTitle.trim())
          
          // Only attempt rename if the proposed filename is different and not just a generic name
          if (proposedFilename !== currentNote.filename && 
              proposedFilename !== 'new-idea.txt' && 
              proposedFilename !== '.txt') {
            
            // Check if the new filename would be unique
            const isUnique = await checkFilenameUnique(proposedFilename, currentNote.filename)
            if (isUnique) {
              // Rename the file using DataContext
              const renameSuccess = await renameIdea(currentNote.filename, proposedFilename)
              if (renameSuccess) {
                console.log('📝 Renamed idea file:', currentNote.filename, '->', proposedFilename)
                newFilename = proposedFilename
              } else {
                console.log('📝 Rename failed, keeping original:', currentNote.filename)
              }
            } else {
              console.log('📝 Filename not unique, keeping original:', currentNote.filename)
            }
          }
        }
        
        // Save with updated title and possibly new filename
        await saveIdea(newFilename, noteState.content, updatedMetadata)
        
        // Update local state to reflect the changes immediately
        setNoteState(prev => ({ 
          ...prev, 
          title: newTitle 
        }))
      }
    } catch (error) {
      console.error('Error processing title change:', error)
    }
  }, [currentNote, noteState.content, saveIdea, renameIdea, checkFilenameUnique])

  // Autosave hook - only saves content changes, not titles
  const { saveNow } = useAutosave(noteState, saveContentOnly, 2000, !!currentNote)

  // Save when switching between ideas
  useEffect(() => {
    const prevIndex = prevIndexRef.current
    if (prevIndex !== currentIndex && ideas[prevIndex]) {
      saveNow()
    }
    prevIndexRef.current = currentIndex
  }, [currentIndex, saveNow, ideas])

  // Save when navigating away from current idea
  useEffect(() => {
    return () => {
      // Save on unmount (navigating away from inbox)
      const currentIdeaNote = currentNoteRef.current
      const currentState = noteStateRef.current
      if (currentIdeaNote && currentState.content !== currentIdeaNote.content) {
        saveNow()
      }
    }
  }, [saveNow])

  const handleTrash = async () => {
    if (!currentNote) return
    
    try {
      await deleteIdea(currentNote.filename)
      await removeCurrentNoteAndAdvance()
    } catch (error) {
      console.error('Error trashing note:', error)
    }
  }

  const handleSkip = () => {
    const newIndex = (currentIndex + 1) % ideas.length
    onStateChange(prev => ({ ...prev, inboxCurrentIndex: newIndex }))
  }

  const handleAccept = async () => {
    if (!currentNote || !noteState.title.trim()) {
      setFilenameError('Title is required')
      return
    }

    try {
      setIsValidatingFilename(true)
      
      // Check if filename would be unique using DataContext
      const filename = titleToFilename(noteState.title.trim()) + '.txt'
      const isUnique = await checkFilenameUnique(filename)
      
      if (!isUnique) {
        setFilenameError(`A note with the filename "${filename}" already exists`)
        setIsValidatingFilename(false)
        return
      }
      
      setIsValidatingFilename(false)
      
      // Promote idea to note with new title, content, and selected concepts using DataContext
      await promoteIdea(
        currentNote.filename, 
        noteState.title.trim(),
        noteState.selectedConcepts
      )

      await removeCurrentNoteAndAdvance()
    } catch (error) {
      console.error('Error accepting note:', error)
      setIsValidatingFilename(false)
    }
  }

  const removeCurrentNoteAndAdvance = async () => {
    // DataContext will handle the actual removal, we just need to handle navigation
    if (ideas.length <= 1) {
      // No more notes, return to main view
      onStateChange({ selectedNote: null, selectedConcept: null, view: 'notes', inboxCount: 0, inboxNotes: [], inboxCurrentIndex: 0 })
      return
    }

    // Calculate new index after removal
    let newIndex = currentIndex
    if (currentIndex >= ideas.length - 1) {
      newIndex = Math.max(0, ideas.length - 2) // Move to previous item since current will be removed
    }
    // Otherwise keep the same index (which will point to the next item after removal)
    
    // Update current index
    onStateChange(prev => ({ 
      ...prev, 
      inboxCurrentIndex: newIndex
    }))
  }

  const generateTransferPin = async () => {
    try {
      setGeneratePinLoading(true)
      
      // Use the IPC system to generate PIN on the main process
      if (window.electronAPI && window.electronAPI.transfer) {
        const pin = await window.electronAPI.transfer.generateTransferPin()
        setTransferPin(pin)
        
        // Auto-expire PIN after 5 minutes (UI state only, server handles expiry)
        setTimeout(() => {
          setTransferPin(null)
        }, 5 * 60 * 1000)
      } else {
        console.error('Transfer API not available')
      }
    } catch (error) {
      console.error('Error generating transfer PIN:', error)
    } finally {
      setGeneratePinLoading(false)
    }
  }

  const copyTransferPin = async () => {
    if (transferPin) {
      try {
        await navigator.clipboard.writeText(transferPin)
        console.log('📋 Transfer PIN copied to clipboard')
      } catch (error) {
        console.error('Error copying to clipboard:', error)
      }
    }
  }

  // Loading state
  useEffect(() => {
    if (ideas.length > 0) {
      setLoading(false)
    }
  }, [ideas])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts when not in an input field
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Only handle specific shortcuts that should work in text fields
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault()
          saveNow()
        }
        return
      }

      // Handle shortcuts when not in text input
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveNow()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
        e.preventDefault()
        handleSkip() // Navigate to next idea
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
        e.preventDefault()
        handleSkip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, saveNow, handleSkip])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading inbox...</div>
          <div className="text-sm text-muted-foreground mt-2">Preparing your ideas</div>
        </div>
      </div>
    )
  }

  if (ideas.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-xl font-medium text-muted-foreground mb-2">📥</div>
          <div className="text-lg font-medium">Inbox is empty</div>
          <div className="text-sm text-muted-foreground mt-2 mb-6">All ideas have been processed! Click the + button in the sidebar to add new ideas.</div>
          <div className="flex gap-2 justify-center">
            <Button 
              variant="outline" 
              onClick={() => onStateChange({ selectedNote: null, selectedConcept: null, view: 'notes', inboxCount: 0 })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Notes
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0">
        {/* Header */}
        <div className="bg-background border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onStateChange({ selectedNote: null, selectedConcept: null, view: 'notes' })}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Notes
              </Button>
              
              <div className="text-sm text-muted-foreground">
                {currentIndex + 1} of {ideas.length}
              </div>
            </div>

            {/* Transfer PIN Section */}
            <div className="flex items-center gap-2">
              {transferPin ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded px-3 py-1">
                  <Smartphone className="h-4 w-4 text-green-600" />
                  <span className="font-mono text-sm">{transferPin}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyTransferPin}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateTransferPin}
                  disabled={generatePinLoading}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  {generatePinLoading ? 'Generating...' : 'Generate PIN'}
                </Button>
              )}

              {/* Undo/Redo buttons */}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={undo}
                  disabled={!canUndo}
                  className="h-8 w-8 p-0"
                >
                  <Undo className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={redo}
                  disabled={!canRedo}
                  className="h-8 w-8 p-0"
                >
                  <Redo className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6">
              {/* Filename Error Alert */}
              {filenameError && (
                <Alert className="mb-4 border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">
                    {filenameError}
                  </AlertDescription>
                </Alert>
              )}

              {/* Title Input */}
              <div className="mb-4">
                <Input
                  value={noteState.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur() // Trigger blur to process title
                    }
                  }}
                  placeholder="Note title..."
                  className="text-lg font-semibold border-none px-0 focus-visible:ring-0"
                />
              </div>

              {/* Content Editor */}
              <div className="flex-1 mb-4">
                <Textarea
                  value={noteState.content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="Start writing..."
                  className="flex-1 resize-none border-none px-0 focus-visible:ring-0 h-full"
                />
              </div>


              {/* Media placeholder */}
              {/* TODO: Add media upload functionality */}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="destructive"
                  onClick={handleTrash}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Trash
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="flex-1"
                >
                  <SkipForward className="h-4 w-4 mr-2" />
                  Skip
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={!noteState.title.trim() || isValidatingFilename}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {isValidatingFilename ? 'Validating...' : 'Accept'}
                </Button>
              </div>

              {/* Keyboard shortcuts hint */}
              <div className="text-xs text-muted-foreground text-center mt-4 opacity-60">
                Cmd+S to save • Cmd+Z to undo • Cmd+Y to redo • Cmd+←/→ to navigate
              </div>
      </div>
    </div>
  )
}