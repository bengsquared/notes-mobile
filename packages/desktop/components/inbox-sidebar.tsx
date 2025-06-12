'use client'

import { FileText, Plus } from 'lucide-react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import type { Note } from '@notes-app/shared'
import { getDisplayTitle } from '../utils/title-utils'

interface InboxSidebarProps {
  inboxNotes: Note[]
  currentIndex: number
  onJumpToNote: (index: number) => void
  onRefreshInbox?: () => Promise<void>
  onCreateAndFocus?: (newIdea: Note) => Promise<void>
}

export function InboxSidebar({ inboxNotes, currentIndex, onJumpToNote, onRefreshInbox, onCreateAndFocus }: InboxSidebarProps) {
  const handleCreateIdea = async () => {
    try {
      const newContent = ''
      
      const newIdea = await window.electronAPI.ideas.create(newContent, {
        processed: false
      })
      
      // Use the new create and focus callback if available, otherwise fall back to refresh
      if (onCreateAndFocus) {
        await onCreateAndFocus(newIdea)
      } else if (onRefreshInbox) {
        await onRefreshInbox()
      }
    } catch (error) {
      console.error('Failed to create new idea:', error)
    }
  }

  return (
    <div className="h-full bg-background flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Inbox</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCreateIdea}
            title="Create new idea"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {inboxNotes.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm p-4">
              <div className="mb-2">No items in inbox</div>
              <div className="text-xs opacity-60">Click + to add a new idea</div>
            </div>
          ) : (
            inboxNotes.map((note, index) => (
              <Button
                key={note.filename}
                variant={index === currentIndex ? 'secondary' : 'ghost'}
                className="w-full justify-start text-sm h-auto py-1 overflow-hidden"
                onClick={() => onJumpToNote(index)}
              >
                <FileText className="mr-2 h-3 w-3 flex-shrink-0" />
                <span className="truncate text-left flex-1 min-w-0">
                  {getDisplayTitle(note.metadata.title, note.content, note.filename)}
                </span>
              </Button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}