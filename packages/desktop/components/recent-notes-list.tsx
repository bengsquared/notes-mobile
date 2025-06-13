
import { ScrollArea } from './ui/scroll-area'
import { Input } from './ui/input'
import { EmptyState } from './ui/empty-state'
import { RecentNoteListItem } from './recent-note-list-item'
import { useSearch } from '../hooks/use-search'
import { Search, Clock } from 'lucide-react'
import { useRecentNotes, useData } from '../contexts/DataContext'
import type { LayoutState } from './main-layout'

interface RecentNotesListProps {
  layoutState: LayoutState
  onNoteSelect: (filename: string) => void
}

export function RecentNotesList({ onNoteSelect }: RecentNotesListProps) {
  // Data from provider
  const { recentNotes, loading } = useRecentNotes()
  const { deleteNote } = useData()

  // Search functionality
  const noteSearch = useSearch({
    items: recentNotes,
    searchFields: ['content'],
    filterFn: (note, query) => {
      const searchLower = query.toLowerCase()
      return (
        note.metadata.title?.toLowerCase().includes(searchLower) ||
        note.content.toLowerCase().includes(searchLower) ||
        note.metadata.concepts?.some(concept => 
          concept.toLowerCase().includes(searchLower)
        ) || false
      )
    }
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
        <div>Loading recent notes...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Clock className="h-5 w-5 mr-2 text-muted-foreground" />
            <h1 className="text-xl font-bold">Recent Notes</h1>
            <span className="ml-2 text-sm text-muted-foreground">
              ({recentNotes.length})
            </span>
          </div>
        </div>
        
        {/* Search */}
        {recentNotes.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search recent notes..."
              value={noteSearch.query}
              onChange={(e) => noteSearch.setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
      </div>

      {/* Notes List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {noteSearch.filteredItems.length === 0 ? (
            recentNotes.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No recent notes"
                description="Your recently modified notes will appear here"
              />
            ) : (
              <EmptyState
                icon={Search}
                title="No notes found"
                description={`No notes match "${noteSearch.query}"`}
              />
            )
          ) : (
            noteSearch.filteredItems.map((note) => (
              <RecentNoteListItem
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