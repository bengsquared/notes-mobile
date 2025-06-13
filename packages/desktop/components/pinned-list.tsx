
import { useState, useEffect } from 'react'
import { ScrollArea } from './ui/scroll-area'
import { Input } from './ui/input'
import { EmptyState } from './ui/empty-state'
import { PinnedListItem } from './pinned-list-item'
import { useSearch } from '../hooks/use-search'
import { Search, Pin } from 'lucide-react'
import { usePinnedItems } from '../contexts/DataContext'
import type { Note, Concept } from '@notes-app/shared'
import type { LayoutState } from './main-layout'

interface PinnedItem {
  type: 'note' | 'concept'
  name: string
  data: Note | Concept
}

interface PinnedListProps {
  layoutState: LayoutState
  onNoteSelect: (filename: string) => void
  onConceptSelect: (conceptName: string) => void
}

export function PinnedList({ onNoteSelect, onConceptSelect }: PinnedListProps) {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([])
  
  // Data from provider
  const { pinnedItems: pinned, loading } = usePinnedItems()

  // Search functionality
  const itemSearch = useSearch({
    items: pinnedItems,
    searchFields: ['name'],
    filterFn: (item, query) => {
      const searchLower = query.toLowerCase()
      if (item.type === 'note') {
        const note = item.data as Note
        return (
          item.name.toLowerCase().includes(searchLower) ||
          note.metadata.title?.toLowerCase().includes(searchLower) ||
          note.content.toLowerCase().includes(searchLower) ||
          note.metadata.concepts?.some(concept => 
            concept.toLowerCase().includes(searchLower)
          ) || false
        )
      } else {
        const concept = item.data as Concept
        return (
          item.name.toLowerCase().includes(searchLower) ||
          concept.content.toLowerCase().includes(searchLower)
        )
      }
    }
  })

  useEffect(() => {
    loadPinnedItems()
  }, [pinned])

  const loadPinnedItems = async () => {
    try {
      const items: PinnedItem[] = []

      // Load pinned notes
      for (const noteFilename of pinned.notes) {
        try {
          const note = await window.electronAPI.notes.load(noteFilename)
          items.push({
            type: 'note',
            name: noteFilename,
            data: note
          })
        } catch (error) {
          console.error(`Error loading pinned note ${noteFilename}:`, error)
        }
      }

      // Load pinned concepts
      for (const conceptName of pinned.concepts) {
        try {
          const concept = await window.electronAPI.concepts.load(conceptName)
          items.push({
            type: 'concept',
            name: conceptName,
            data: concept
          })
        } catch (error) {
          console.error(`Error loading pinned concept ${conceptName}:`, error)
        }
      }

      // Sort by modification date (most recent first)
      items.sort((a, b) => {
        const aDate = new Date(a.data.metadata.modified || 0).getTime()
        const bDate = new Date(b.data.metadata.modified || 0).getTime()
        return bDate - aDate
      })

      setPinnedItems(items)
    } catch (error) {
      console.error('Error loading pinned items:', error)
    }
  }

  const deleteNote = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
      return
    }

    try {
      await window.electronAPI.trashNote(filename)
      // Refresh the pinned items list
      await loadPinnedItems()
    } catch (error) {
      console.error('Error deleting note:', error)
      alert('Failed to delete note. Please try again.')
    }
  }


  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div>Loading pinned items...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Pin className="h-5 w-5 mr-2 text-muted-foreground" />
            <h1 className="text-xl font-bold">Pinned Items</h1>
            <span className="ml-2 text-sm text-muted-foreground">
              ({pinnedItems.length})
            </span>
          </div>
        </div>
        
        {/* Search */}
        {pinnedItems.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search pinned items..."
              value={itemSearch.query}
              onChange={(e) => itemSearch.setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
      </div>

      {/* Items List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {itemSearch.filteredItems.length === 0 ? (
            pinnedItems.length === 0 ? (
              <EmptyState
                icon={Pin}
                title="No pinned items"
                description="Pin notes and concepts for quick access"
              />
            ) : (
              <EmptyState
                icon={Search}
                title="No items found"
                description={`No items match "${itemSearch.query}"`}
              />
            )
          ) : (
            itemSearch.filteredItems.map((item) => (
              <PinnedListItem
                key={`${item.type}-${item.name}`}
                type={item.type}
                name={item.name}
                data={item.data}
                onNoteSelect={onNoteSelect}
                onConceptSelect={onConceptSelect}
                onDeleteNote={deleteNote}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}