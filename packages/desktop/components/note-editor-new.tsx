
import { useState, useEffect, useCallback, useRef } from 'react'

import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { EditorLayout, EditorAction } from './ui/editor-layout'
import { Trash2 } from 'lucide-react'

import { useUndoRedo, useAutosave, useErrorHandler } from '@notes-app/shared'
import { usePinState } from '../hooks/use-pin-state'
import { useDataHandler } from '../hooks/use-data-handler'
import { useData } from '../contexts/DataContext'
import { titleToFilename } from '../utils/filename'
import { formatDateTime } from '../utils/date'

import type { Note } from '@notes-app/shared'
import type { LayoutState } from './main-layout'

interface NoteEditorProps {
  noteFilename: string
  onBack: () => void
  onStateChange: (state: LayoutState) => void
}

interface NoteState {
  title: string
  content: string
}

export function NoteEditor({ noteFilename, onBack }: NoteEditorProps) {
  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  
  const { error, handleError, setValidating, clearError, setErrorMessage } = useErrorHandler()
  const { isPinned, togglePin } = usePinState('note', noteFilename)
  const dataHandler = useDataHandler()
  const { saveNote: saveNoteToContext, deleteNote: deleteNoteFromContext, renameNote } = useData()

  // Undo/redo state for title and content together
  const {
    state: noteState,
    set: setNoteState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory
  } = useUndoRedo<NoteState>({ title: '', content: '' })

  const saveNote = useCallback(async (noteData: NoteState) => {
    if (!note) return
    
    try {
      clearError()
      
      // Generate new filename from title
      const newFilename = titleToFilename(noteData.title)
      if (!newFilename) {
        setErrorMessage('Title is required')
        throw new Error('Title is required')
      }
      
      // Check if we need to rename the file (title changed)
      if (newFilename !== note.filename) {
        setValidating(true)
        
        // Check if new filename is unique
        const isUnique = await dataHandler.checkFilenameUnique(newFilename, note.filename)
        if (!isUnique) {
          const error = `A note with the title "${noteData.title}" already exists`
          setErrorMessage(error)
          setValidating(false)
          throw new Error(error)
        }
        
        // Rename the note file first
        await renameNote(note.filename, newFilename)
        
        // Update the note state with new filename
        setNote(prev => prev ? { ...prev, filename: newFilename } : null)
        
        setValidating(false)
      }
      
      // Save the content with updated metadata
      const targetFilename = newFilename !== note.filename ? newFilename : note.filename
      await saveNoteToContext(targetFilename, noteData.content, {
        ...note.metadata,
        title: noteData.title.trim(),
        modified: new Date().toISOString()
      })
      
      setLastSaved(new Date())
      
      // Update local note state
      setNote(prev => prev ? {
        ...prev,
        filename: targetFilename,
        content: noteData.content,
        metadata: {
          ...prev.metadata,
          title: noteData.title.trim(),
          modified: new Date().toISOString()
        }
      } : null)
    } catch (err) {
      handleError(err)
      throw err
    }
  }, [note, dataHandler, renameNote, saveNoteToContext])

  const loadNote = useCallback(async () => {
    try {
      const noteData = await dataHandler.loadNote(noteFilename)
      setNote(noteData)
      const initialState = {
        title: noteData.metadata.title || '',
        content: noteData.content
      }
      resetHistory(initialState)
      setLoading(false)
    } catch (error) {
      console.error('Error loading note:', error)
      setLoading(false)
    }
  }, [dataHandler, noteFilename, resetHistory])

  // Autosave hook
  const { saveNow } = useAutosave(noteState, saveNote, 2000, !!note)

  useEffect(() => {
    loadNote()
  }, [noteFilename, loadNote])

  // Save when leaving the editor - use refs to get current values
  const noteRef = useRef(note)
  const noteStateRef = useRef(noteState)
  noteRef.current = note
  noteStateRef.current = noteState

  useEffect(() => {
    return () => {
      const currentNote = noteRef.current
      const currentState = noteStateRef.current
      if (currentNote && (currentState.title !== currentNote.metadata.title || currentState.content !== currentNote.content)) {
        saveNow()
      }
    }
  }, [saveNow]) // Include saveNow in deps

  const handleTitleChange = (newTitle: string) => {
    setNoteState(prev => ({ ...prev, title: newTitle }))
    // Clear error when user starts typing
    if (error.message) {
      clearError()
    }
  }

  const handleContentChange = (newContent: string) => {
    setNoteState(prev => ({ ...prev, content: newContent }))
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

  const deleteNote = async () => {
    if (!note) return
    
    if (!confirm(`Are you sure you want to delete "${note.metadata.title || note.filename}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteNoteFromContext(note.filename)
      // Navigate back after successful deletion
      onBack()
    } catch (error) {
      console.error('Error deleting note:', error)
      setErrorMessage('Failed to delete note. Please try again.')
    }
  }

  const editorActions: EditorAction[] = [
    {
      icon: Trash2,
      label: 'Delete note',
      onClick: deleteNote,
      variant: 'ghost'
    }
  ]

  if (!note) {
    return (
      <EditorLayout title="Note not found" loading={loading} onBack={onBack}>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Note not found</p>
        </div>
      </EditorLayout>
    )
  }

  return (
    <EditorLayout
      title={noteState.title || note.filename}
      loading={loading}
      error={error.message}
      onBack={onBack}
      lastSaved={lastSaved}
      canUndo={canUndo}
      canRedo={canRedo}
      onUndo={undo}
      onRedo={redo}
      isPinned={isPinned}
      onTogglePin={togglePin}
      actions={editorActions}
      footerInfo={
        <div className="text-sm text-muted-foreground flex justify-between">
          <div>
            <div>Created: {formatDateTime(note.metadata.created)}</div>
            <div>Modified: {formatDateTime(note.metadata.modified)}</div>
          </div>
          <div className="text-xs opacity-60">
            Cmd+S to save • Cmd+Z to undo • Cmd+Y to redo
          </div>
        </div>
      }
    >
      <div className="p-6 flex flex-col h-full">
        {/* Title */}
        <div className="mb-4">
          <Input
            placeholder="Note title..."
            value={noteState.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className={`text-lg font-semibold border-none px-0 focus-visible:ring-0 ${
              error.message ? 'border-red-500' : ''
            }`}
          />
          {error.isValidating && (
            <div className="text-xs text-muted-foreground mt-1">
              Checking filename availability...
            </div>
          )}
        </div>

        {/* Content */}
        <Textarea
          value={noteState.content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder="Start writing..."
          className="flex-1 resize-none border-none px-0 focus-visible:ring-0"
        />
      </div>
    </EditorLayout>
  )
}