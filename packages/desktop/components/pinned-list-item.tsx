'use client'

import { ItemCard, ItemCardAction } from './ui/item-card'
import { usePinState } from '../hooks/use-pin-state'
import { FileText, Hash, PinOff, Trash2 } from 'lucide-react'
import type { Note, Concept } from '@notes-app/shared'

interface PinnedListItemProps {
  type: 'note' | 'concept'
  name: string
  data: Note | Concept
  onNoteSelect: (filename: string) => void
  onConceptSelect: (conceptName: string) => void
  onDeleteNote?: (filename: string) => void
}

export function PinnedListItem({ 
  type, 
  name, 
  data, 
  onNoteSelect, 
  onConceptSelect,
  onDeleteNote 
}: PinnedListItemProps) {
  const { togglePin } = usePinState(type, name)

  const actions: ItemCardAction[] = [
    {
      icon: type === 'note' ? FileText : Hash,
      label: type === 'note' ? 'Open note' : 'Open concept',
      onClick: () => {
        if (type === 'note') {
          onNoteSelect(name)
        } else {
          onConceptSelect(name)
        }
      }
    },
    {
      icon: PinOff,
      label: 'Unpin',
      onClick: togglePin,
      alwaysVisible: true // Always show unpin for pinned items
    }
  ]

  // Add delete action only for notes
  if (type === 'note' && onDeleteNote) {
    actions.push({
      icon: Trash2,
      label: 'Delete note',
      onClick: () => onDeleteNote(name),
      variant: 'destructive'
    })
  }

  const title = type === 'note' 
    ? (data as Note).metadata.title || name.replace('.txt', '')
    : `#${name}`

  const description = data.content.substring(0, 150) + (data.content.length > 150 ? '...' : '')

  const concepts = type === 'note' ? (data as Note).metadata.concepts : undefined

  return (
    <ItemCard
      title={title}
      description={description}
      timestamp={data.metadata.modified}
      concepts={concepts}
      icon={type === 'note' ? FileText : Hash}
      badge={type === 'note' ? 'Note' : 'Concept'}
      actions={actions}
      onClick={() => {
        if (type === 'note') {
          onNoteSelect(name)
        } else {
          onConceptSelect(name)
        }
      }}
    />
  )
}