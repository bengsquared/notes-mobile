'use client'

import { ItemCard, ItemCardAction } from './ui/item-card'
import { usePinState } from '../hooks/use-pin-state'
import { FileText, Trash2, Pin, PinOff } from 'lucide-react'
import type { Note } from '@notes-app/shared'

interface RecentNoteListItemProps {
  note: Note
  onSelect: (filename: string) => void
  onDelete: (filename: string) => void
}

function formatRelativeTime(dateString?: string) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMinutes > 0) return `${diffMinutes}m ago`
  return 'Just now'
}

export function RecentNoteListItem({ note, onSelect, onDelete }: RecentNoteListItemProps) {
  const { isPinned, togglePin } = usePinState('note', note.filename)

  const actions: ItemCardAction[] = [
    {
      icon: FileText,
      label: 'Open note',
      onClick: () => onSelect(note.filename)
    },
    {
      icon: isPinned ? PinOff : Pin,
      label: isPinned ? 'Unpin' : 'Pin',
      onClick: togglePin,
      alwaysVisible: isPinned
    },
    {
      icon: Trash2,
      label: 'Delete note',
      onClick: () => onDelete(note.filename),
      variant: 'destructive'
    }
  ]

  return (
    <ItemCard
      title={note.metadata.title || note.filename.replace('.txt', '')}
      description={note.content.substring(0, 150) + (note.content.length > 150 ? '...' : '')}
      timestamp={note.metadata.modified}
      badge={formatRelativeTime(note.metadata.modified)}
      concepts={note.metadata.concepts}
      icon={FileText}
      actions={actions}
      onClick={() => onSelect(note.filename)}
    />
  )
}