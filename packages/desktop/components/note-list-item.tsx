'use client'

import { ItemCard, ItemCardAction } from './ui/item-card'
import { usePinState } from '../hooks/use-pin-state'
import { FileText, Trash2, Pin, PinOff } from 'lucide-react'
import type { Note } from '../../../shared/src/types'

interface NoteListItemProps {
  note: Note
  onSelect: (filename: string) => void
  onDelete: (filename: string) => void
}

export function NoteListItem({ note, onSelect, onDelete }: NoteListItemProps) {
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
      concepts={note.metadata.concepts}
      icon={FileText}
      actions={actions}
      onClick={() => onSelect(note.filename)}
    />
  )
}