'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ArrowLeft, Undo, Redo, Pin, PinOff, Trash2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { useUndoRedo, useAutosave } from '@notes-app/shared'
import { usePinState } from '../hooks/use-pin-state'
import type { Concept } from '@notes-app/shared'
import type { LayoutState } from './main-layout'
import { dataHandler } from '../src/lib/data-handler'

interface ConceptEditorProps {
  conceptName: string
  onBack: () => void
  onStateChange: (state: LayoutState) => void
}

interface ConceptState {
  content: string
}

export function ConceptEditor({ conceptName, onBack, onStateChange }: ConceptEditorProps) {
  const [concept, setConcept] = useState<Concept | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  // Pin state management
  const { isPinned, togglePin } = usePinState('concept', conceptName)

  // Undo/redo state for content
  const {
    state: conceptState,
    set: setConceptState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory
  } = useUndoRedo<ConceptState>({ content: '' })

  const saveConcept = useCallback(async (conceptData: ConceptState) => {
    if (!concept) return
    
    try {
      await window.electronAPI.concepts.save(concept.name, conceptData.content, {
        ...concept.metadata,
        modified: new Date().toISOString()
      })
      
      setLastSaved(new Date())
      
      // Update local concept state
      setConcept(prev => prev ? {
        ...prev,
        content: conceptData.content,
        metadata: {
          ...prev.metadata,
          modified: new Date().toISOString()
        }
      } : null)
    } catch (error) {
      console.error('Error saving concept:', error)
      throw error
    }
  }, [concept])

  // Autosave hook
  const { saveNow } = useAutosave(conceptState, saveConcept, 2000, !!concept)

  useEffect(() => {
    loadConcept()
  }, [conceptName])

  // Save when leaving the editor - use refs to get current values
  const conceptRef = useRef(concept)
  const conceptStateRef = useRef(conceptState)
  conceptRef.current = concept
  conceptStateRef.current = conceptState

  useEffect(() => {
    return () => {
      const currentConcept = conceptRef.current
      const currentState = conceptStateRef.current
      if (currentConcept && currentState.content !== currentConcept.content) {
        saveNow()
      }
    }
  }, [saveNow]) // Include saveNow in deps

  const loadConcept = async () => {
    try {
      const conceptData = await dataHandler.loadConcept(conceptName)
      setConcept(conceptData)
      resetHistory({ content: conceptData.content })
      setLoading(false)
    } catch (error) {
      console.error('Error loading concept:', error)
      setLoading(false)
    }
  }


  const handleContentChange = (newContent: string) => {
    setConceptState(prev => ({ ...prev, content: newContent }))
  }

  const handleDelete = async () => {
    if (!concept) return
    
    try {
      setDeleting(true)
      await window.electronAPI.concepts.delete(concept.name)
      setShowDeleteDialog(false)
      // Navigate back to concepts list
      onBack()
    } catch (error) {
      console.error('Error deleting concept:', error)
    } finally {
      setDeleting(false)
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveNow()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, saveNow])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div>Loading concept...</div>
      </div>
    )
  }

  if (!concept) {
    return (
      <div className="h-full flex items-center justify-center">
        <div>Concept not found</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="ml-4">
            <h1 className="text-xl font-bold">#{concept.name}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Delete button */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowDeleteDialog(true)}
            title="Delete concept"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          {/* Pin button */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={togglePin}
            title={isPinned ? 'Unpin concept' : 'Pin concept'}
          >
            {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>

          {/* Undo/Redo buttons */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Cmd+Z)"
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Cmd+Y)"
          >
            <Redo className="h-4 w-4" />
          </Button>
          
          {/* Save status */}
          <div className="text-sm text-muted-foreground ml-2">
            {lastSaved ? (
              <span>Saved {lastSaved.toLocaleTimeString()}</span>
            ) : (
              <span>Autosave enabled</span>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 p-6 flex flex-col">
        {/* Content */}
        <Textarea
          value={conceptState.content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Define this concept..."
          className="flex-1 resize-none border-none px-0 focus-visible:ring-0"
        />

        {/* Footer info */}
        <div className="mt-4 text-sm text-muted-foreground flex justify-between">
          <div>
            <div>Created: {concept.metadata.created ? new Date(concept.metadata.created).toLocaleString() : 'Unknown'}</div>
            <div>Modified: {concept.metadata.modified ? new Date(concept.metadata.modified).toLocaleString() : 'Unknown'}</div>
            {concept.metadata.linkedNotes && concept.metadata.linkedNotes.length > 0 && (
              <div>Linked notes: {concept.metadata.linkedNotes.length}</div>
            )}
          </div>
          <div className="text-xs opacity-60">
            Cmd+S to save • Cmd+Z to undo • Cmd+Y to redo
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Concept</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the concept <strong>#{concept.name}</strong>?
            </p>
            {concept.metadata.linkedNotes && concept.metadata.linkedNotes.length > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This concept is linked to {concept.metadata.linkedNotes.length} note{concept.metadata.linkedNotes.length !== 1 ? 's' : ''}. 
                  Deleting it will remove these relationships.
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground mt-3">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Concept'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}