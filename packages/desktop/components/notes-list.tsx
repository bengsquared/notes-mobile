
import { useState } from 'react'
import { ScrollArea } from './ui/scroll-area'
import { Input } from './ui/input'
import { EmptyState } from './ui/empty-state'
import { NoteListItem } from './note-list-item'
import { Search, FileText } from 'lucide-react'
import { useNotes } from '../contexts/DataContext'
import type { LayoutState } from './main-layout'

interface NotesListProps {
  layoutState: LayoutState
  onNoteSelect: (filename: string) => void
  onStateChange?: (state: LayoutState) => void
}

export function NotesList({ onNoteSelect }: NotesListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  
  // Data from provider
  const { notes, loading, deleteNote } = useNotes()

  const filteredNotes = notes.filter(note => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      note.metadata.title?.toLowerCase().includes(searchLower) ||
      note.content.toLowerCase().includes(searchLower) ||
      note.metadata.concepts?.some(concept => 
        concept.toLowerCase().includes(searchLower)
      )
    )
  })



  const handleDeleteNote = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteNote(filename)
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('Failed to delete note. Please try again.')
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div>Loading notes...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">All Notes</h1>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Notes List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredNotes.length === 0 ? (
            searchQuery ? (
              <EmptyState
                icon={Search}
                title="No notes found"
                description={`No notes match "${searchQuery}"`}
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="No notes yet"
                description="Process ideas from your inbox to create notes"
              />
            )
          ) : (
            filteredNotes.map((note) => (
              <NoteListItem
                key={note.filename}
                note={note}
                onSelect={onNoteSelect}
                onDelete={handleDeleteNote}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}