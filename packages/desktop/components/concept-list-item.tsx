'use client'

import { useState } from 'react'
import { ItemCard, ItemCardAction } from './ui/item-card'
import { usePinState } from '../hooks/use-pin-state'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Hash, Pin, PinOff, Trash2 } from 'lucide-react'
import type { Concept } from '@notes-app/shared'

interface ConceptListItemProps {
  concept: Concept
  onSelect: (conceptName: string) => void
  onDelete?: (conceptName: string) => Promise<void>
}

function getLinkedNotesCount(concept: Concept): number {
  return concept.metadata.linkedNotes?.length || 0
}

export function ConceptListItem({ concept, onSelect, onDelete }: ConceptListItemProps) {
  const { isPinned, togglePin } = usePinState('concept', concept.name)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const linkedNotesCount = getLinkedNotesCount(concept)
  
  const handleDelete = async () => {
    if (!onDelete) return
    
    try {
      setDeleting(true)
      await onDelete(concept.name)
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Error deleting concept:', error)
    } finally {
      setDeleting(false)
    }
  }

  const actions: ItemCardAction[] = [
    {
      icon: Hash,
      label: 'Open concept',
      onClick: () => onSelect(concept.name)
    },
    {
      icon: isPinned ? PinOff : Pin,
      label: isPinned ? 'Unpin' : 'Pin',
      onClick: togglePin,
      alwaysVisible: isPinned
    }
  ]

  // Add delete action if onDelete is provided
  if (onDelete) {
    actions.push({
      icon: Trash2,
      label: 'Delete concept',
      onClick: (e) => {
        e?.stopPropagation()
        setShowDeleteDialog(true)
      },
      variant: 'destructive'
    })
  }

  return (
    <>
      <ItemCard
        title={`#${concept.name}`}
        description={concept.content.substring(0, 150) + (concept.content.length > 150 ? '...' : '')}
        timestamp={concept.metadata.modified}
        badge={linkedNotesCount > 0 ? `${linkedNotesCount} note${linkedNotesCount !== 1 ? 's' : ''}` : undefined}
        icon={Hash}
        actions={actions}
        onClick={() => onSelect(concept.name)}
      />
      
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
            {linkedNotesCount > 0 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> This concept is linked to {linkedNotesCount} note{linkedNotesCount !== 1 ? 's' : ''}. 
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
    </>
  )
}