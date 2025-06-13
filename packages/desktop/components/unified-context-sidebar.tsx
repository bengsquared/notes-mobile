
import React, { useState, useEffect } from 'react'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { EnhancedTextarea } from './ui/enhanced-textarea'
import { Separator } from './ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { Hash, Plus, X, FileText } from 'lucide-react'
import { LinkSearch, conceptsToSearchItems, notesToSearchItems } from './link-search'
import { useConceptSearch, useNoteSearch } from '../hooks/use-search'
import { useErrorHandler } from '@notes-app/shared'
import { ErrorAlert } from './ui/error-alert'
import { useUnifiedContext } from '../contexts/DataContext'
import { dataHandler } from '../src/lib/data-handler'
import type { Note, Concept } from '@notes-app/shared'
import type { Idea } from '../src/lib/storage'
import type { LayoutState } from './main-layout'

interface UnifiedContextSidebarProps {
  layoutState: LayoutState
  onStateChange: (state: LayoutState) => void
  onToggleCollapse?: () => void
  // Unified item can be either a note, idea, or concept
  currentItem: Note | Idea | Concept | null
  // Callback functions for operations - makes component truly unified
  onConceptAttach: (conceptName: string) => Promise<void>
  onConceptRemove: (conceptName: string) => Promise<void>
  onNoteLink: (noteFilename: string) => Promise<void>
  onNoteLinkRemove: (noteFilename: string) => Promise<void>
  // Optional callback when item metadata changes (for local state sync)
  onItemChange?: (updatedItem: Note | Idea | Concept) => void
}

export function UnifiedContextSidebar({ 
  layoutState, 
  onStateChange, 
  onToggleCollapse,
  currentItem,
  onConceptAttach,
  onConceptRemove,
  onNoteLink,
  onNoteLinkRemove,
  onItemChange
}: UnifiedContextSidebarProps) {
  
  // Log currentItem whenever it changes
  React.useEffect(() => {
    console.log('🎯 UnifiedContextSidebar - currentItem changed:', currentItem);
    if (currentItem) {
      console.log('🎯 UnifiedContextSidebar - currentItem metadata:', currentItem.metadata);
      if ('name' in currentItem) {
        console.log('🎯 UnifiedContextSidebar - Concept relatedConcepts:', (currentItem as Concept).metadata.relatedConcepts);
      }
    }
  }, [currentItem]);
  const [suggestedConcepts, setSuggestedConcepts] = useState<string[]>([])
  const [newConceptName, setNewConceptName] = useState('')
  const [createConceptDialogOpen, setCreateConceptDialogOpen] = useState(false)
  
  // Search states
  const [showConceptSearch, setShowConceptSearch] = useState(false)
  const [showNoteSearch, setShowNoteSearch] = useState(false)
  
  // Concept editing states
  const [showRelatedConceptSearch, setShowRelatedConceptSearch] = useState(false)
  
  // Error handling
  const { error, handleError } = useErrorHandler()
  
  // Data for UI rendering only
  const {
    concepts,
    notes,
    suggestConcepts,
    createConcept,
    addConceptRelation
  } = useUnifiedContext()
  
  // Search hooks
  const allConceptNames = concepts.map(c => c.name)
  const currentConcepts = (currentItem && 'concepts' in currentItem.metadata) 
    ? currentItem.metadata.concepts || [] 
    : []
  const currentLinks = (currentItem && 'links' in currentItem.metadata) 
    ? currentItem.metadata.links || [] 
    : []
  
  const conceptSearch = useConceptSearch(
    allConceptNames, 
    currentConcepts
  )
  
  const noteSearch = useNoteSearch(notes)

  useEffect(() => {
    if (currentItem) {
      loadItemContext()
    } else {
      setSuggestedConcepts([])
    }
  }, [currentItem])

  const loadItemContext = async () => {
    if (!currentItem) return
    
    try {
      // Get concept suggestions
      const conceptSuggestions = await suggestConcepts(currentItem.content)
      setSuggestedConcepts(conceptSuggestions.filter(c => !currentConcepts.includes(c)))
    } catch (error) {
      handleError(error, 'Failed to load context suggestions')
    }
  }

  const handleConceptAttach = async (conceptName: string) => {
    if (!currentItem) return
    
    try {
      await onConceptAttach(conceptName)
      setSuggestedConcepts(prev => prev.filter(c => c !== conceptName))
      
      // Notify parent of change for local state sync
      if (onItemChange && currentItem && 'concepts' in currentItem.metadata) {
        const updatedItem = {
          ...currentItem,
          metadata: {
            ...currentItem.metadata,
            concepts: [...(currentItem.metadata.concepts || []), conceptName]
          }
        }
        onItemChange(updatedItem)
      }
    } catch (error) {
      handleError(error, 'Failed to attach concept')
    }
  }

  const handleConceptRemove = async (conceptName: string) => {
    if (!currentItem) return
    
    try {
      await onConceptRemove(conceptName)
      // Add back to suggestions if it was auto-suggested
      const suggestions = await suggestConcepts(currentItem.content)
      if (suggestions.includes(conceptName)) {
        setSuggestedConcepts(prev => [...prev, conceptName])
      }
      
      // Notify parent of change for local state sync
      if (onItemChange && currentItem && 'concepts' in currentItem.metadata) {
        const updatedItem = {
          ...currentItem,
          metadata: {
            ...currentItem.metadata,
            concepts: (currentItem.metadata.concepts || []).filter(c => c !== conceptName)
          }
        }
        onItemChange(updatedItem)
      }
    } catch (error) {
      handleError(error, 'Failed to remove concept')
    }
  }


  const handleCreateConcept = async () => {
    if (!newConceptName.trim()) return
    
    try {
      await createConcept(newConceptName)
      await handleConceptAttach(newConceptName)
      setNewConceptName('')
      setCreateConceptDialogOpen(false)
    } catch (error) {
      handleError(error, 'Failed to create concept')
    }
  }

  const handleNoteLink = async (noteFilename: string) => {
    try {
      await onNoteLink(noteFilename)
      // Close search
      setShowNoteSearch(false)
      noteSearch.setQuery('')
    } catch (error) {
      handleError(error, 'Failed to link note')
    }
  }

  const handleNoteLinkRemove = async (noteFilename: string) => {
    try {
      await onNoteLinkRemove(noteFilename)
    } catch (error) {
      handleError(error, 'Failed to remove note link')
    }
  }

  // Concept editing handlers

  const handleAddRelatedConcept = async (conceptName: string) => {
    if (!itemInfo.isViewingConcept || !currentItem) return
    
    try {
      // Add bidirectional concept relation using DataContext
      await addConceptRelation((currentItem as Concept).name, conceptName)
      setShowRelatedConceptSearch(false)
      
      // Reload the concept from the server to get fresh data
      if (onItemChange) {
        try {
          const refreshedConcept = await dataHandler.loadConcept((currentItem as Concept).name)
          onItemChange(refreshedConcept)
        } catch (error) {
          console.error('Failed to reload concept after adding relation:', error)
          // Fallback to optimistic update
          const updatedConcept = {
            ...currentItem,
            metadata: {
              ...currentItem.metadata,
              relatedConcepts: [...((currentItem as Concept).metadata.relatedConcepts || []), conceptName]
            }
          }
          onItemChange(updatedConcept)
        }
      }
    } catch (error) {
      handleError(error, 'Failed to add related concept')
    }
  }

  const handleRemoveRelatedConcept = async (conceptName: string) => {
    if (!itemInfo.isViewingConcept || !currentItem) return
    
    try {
      // Remove bidirectional concept relation
      await window.electronAPI.concepts.removeRelation((currentItem as Concept).name, conceptName)
      
      // Update local state
      if (onItemChange) {
        const updatedConcept = {
          ...currentItem,
          metadata: {
            ...currentItem.metadata,
            relatedConcepts: ((currentItem as Concept).metadata.relatedConcepts || []).filter(c => c !== conceptName)
          }
        }
        onItemChange(updatedConcept)
      }
    } catch (error) {
      handleError(error, 'Failed to remove related concept')
    }
  }

  // Helper to determine item type and get appropriate title
  const getItemInfo = (item: Note | Idea | Concept | null) => {
    if (!item) return { type: null, title: '', isViewingConcept: false }
    
    // Check if it's a concept (has 'name' property instead of 'filename')
    if ('name' in item && !('filename' in item)) {
      return { 
        type: 'concept' as const, 
        title: `#${item.name}`, 
        isViewingConcept: true 
      }
    }
    
    // It's a note or idea
    return { 
      type: ('location' in item && item.location === 'inbox') ? 'idea' : 'note' as const, 
      title: (item as Note | Idea).metadata?.title || `${(item as Note | Idea).filename.replace('.txt', '')}`,
      isViewingConcept: false
    }
  }

  const itemInfo = getItemInfo(currentItem)
  const itemTitle = itemInfo.title

  return (
    <div className="h-full border-l bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">
            Context
          </h3>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {itemTitle && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {itemTitle}
          </p>
        )}
      </div>

      {/* Error Display */}
      {error.message && (
        <div className="p-4">
          <ErrorAlert message={error.message} />
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <ErrorAlert message={error.message} />
          
          {currentItem ? (
            itemInfo.isViewingConcept ? (
              /* Concept view - show concept-specific information */
              <>
                {/* Enhanced Concept Description */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Description</h4>
                    <div className="text-xs text-muted-foreground">
                      Cmd+Z/Y for undo/redo
                    </div>
                  </div>
                  
                  <EnhancedTextarea
                    value={currentItem.content || ''}
                    onChange={(newContent: string) => {
                      // Update the current item immediately for responsive UI
                      const updatedItem = { ...currentItem, content: newContent } as Concept
                      onItemChange?.(updatedItem)
                    }}
                    onSave={async (content: string) => {
                      // Save to backend
                      await window.electronAPI.concepts.save(
                        (currentItem as Concept).name, 
                        content, 
                        (currentItem as Concept).metadata
                      )
                    }}
                    placeholder="Define this concept..."
                    className="min-h-[100px] text-sm resize-none"
                    autosaveDelay={2000}
                    enableUndoRedo={true}
                    enableAutosave={true}
                    enableKeyboardShortcuts={true}
                  />
                </div>

                <Separator />

                {/* Editable Related Concepts */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center">
                      <Hash className="h-4 w-4 mr-2" />
                      Related Concepts ({(() => {
                        const count = (currentItem as Concept).metadata.relatedConcepts?.length || 0;
                        console.log('🎯 UnifiedContextSidebar - Displaying related concepts count:', count);
                        console.log('🎯 UnifiedContextSidebar - relatedConcepts array:', (currentItem as Concept).metadata.relatedConcepts);
                        return count;
                      })()})
                    </h4>
                  </div>
                  
                  {/* Related concept search */}
                  <LinkSearch
                    title="Add Related Concepts"
                    placeholder="Search concepts to relate..."
                    searchQuery={conceptSearch.query}
                    onSearchChange={conceptSearch.setQuery}
                    isOpen={showRelatedConceptSearch}
                    onToggle={() => setShowRelatedConceptSearch(!showRelatedConceptSearch)}
                    items={conceptsToSearchItems(
                      conceptSearch.filteredItems.filter(concept => 
                        concept !== (currentItem as Concept).name && 
                        !((currentItem as Concept).metadata.relatedConcepts || []).includes(concept)
                      )
                    )}
                    onItemSelect={(item) => handleAddRelatedConcept(item.id)}
                    emptyMessage="No available concepts found"
                  />
                  
                  {/* Current related concepts */}
                  {(currentItem as Concept).metadata.relatedConcepts && (currentItem as Concept).metadata.relatedConcepts!.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      {(currentItem as Concept).metadata.relatedConcepts!.map((relatedConceptName) => (
                        <div key={relatedConceptName} className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-1 justify-start text-sm"
                            onClick={() => onStateChange({ 
                              ...layoutState, 
                              view: 'concept-editor', 
                              selectedConcept: relatedConceptName, 
                              selectedNote: undefined 
                            })}
                          >
                            #{relatedConceptName}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => handleRemoveRelatedConcept(relatedConceptName)}
                            aria-label={`Remove relation to ${relatedConceptName}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-3">
                      No related concepts
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Note/Idea view - show note/idea-specific information */
              <>
                {/* Concepts */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center">
                      <Hash className="h-4 w-4 mr-2" />
                      Concepts
                    </h4>
                    <Dialog open={createConceptDialogOpen} onOpenChange={setCreateConceptDialogOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          aria-label="Create new concept"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create New Concept</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <Input
                            placeholder="Concept name..."
                            value={newConceptName}
                            onChange={(e) => setNewConceptName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCreateConcept()
                              } else if (e.key === 'Escape') {
                                setCreateConceptDialogOpen(false)
                              }
                            }}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setCreateConceptDialogOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={handleCreateConcept}
                              disabled={!newConceptName.trim()}
                            >
                              Create
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Concept search */}
                  <LinkSearch
                    title="Search & Attach Concepts"
                    placeholder="Search concepts to attach..."
                    searchQuery={conceptSearch.query}
                    onSearchChange={conceptSearch.setQuery}
                    isOpen={showConceptSearch}
                    onToggle={() => setShowConceptSearch(!showConceptSearch)}
                    items={conceptsToSearchItems(
                      conceptSearch.filteredItems.filter(concept => !currentConcepts.includes(concept))
                    )}
                    onItemSelect={(item) => handleConceptAttach(item.id)}
                    emptyMessage="No available concepts found"
                  />

                  {/* Current concepts */}
                  {currentConcepts.length > 0 ? (
                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Current Concepts</div>
                      <div className="space-y-1">
                        {currentConcepts.map((conceptName) => (
                          <div key={conceptName} className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 justify-start text-sm"
                              onClick={() => onStateChange({ ...layoutState, view: 'concept-editor', selectedConcept: conceptName, selectedNote: undefined })}
                            >
                              #{conceptName}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => handleConceptRemove(conceptName)}
                              aria-label={`Remove ${conceptName} concept`}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-3">
                      No concepts assigned
                    </div>
                  )}
                </div>

                <Separator />

                {/* Suggested Concepts */}
                <div>
                  <h4 className="font-medium mb-3">Suggested Concepts</h4>
                  {suggestedConcepts.length > 0 ? (
                    <div className="space-y-1">
                      {suggestedConcepts.map((conceptName) => (
                        <Button
                          key={conceptName}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-sm"
                          onClick={() => handleConceptAttach(conceptName)}
                          title={`Attach concept: ${conceptName}`}
                        >
                          <Plus className="h-3 w-3 mr-2" />
                          #{conceptName}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No concept suggestions
                    </div>
                  )}
                </div>

                <Separator />

                {/* Linked Notes */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      Linked Notes
                    </h4>
                  </div>

                  {/* Note search */}
                  <LinkSearch
                    title="Search & Link Notes"
                    placeholder="Search notes to link..."
                    searchQuery={noteSearch.query}
                    onSearchChange={noteSearch.setQuery}
                    isOpen={showNoteSearch}
                    onToggle={() => setShowNoteSearch(!showNoteSearch)}
                    items={notesToSearchItems(
                      noteSearch.filteredItems.filter(note => 
                        note.filename !== (currentItem as Note | Idea)?.filename && 
                        !currentLinks.includes(note.filename)
                      )
                    )}
                    onItemSelect={(item) => handleNoteLink(item.id)}
                    emptyMessage="No available notes found"
                  />

                  {/* Current linked notes */}
                  {currentLinks.length > 0 ? (
                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Linked Notes</div>
                      <div className="space-y-1">
                        {currentLinks.map((noteFilename) => {
                          const linkedNote = noteSearch.filteredItems.find((n: Note) => n.filename === noteFilename)
                          const title = linkedNote?.metadata.title || noteFilename.replace('.txt', '')
                          return (
                            <div key={noteFilename} className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="flex-1 justify-start text-sm"
                                onClick={() => onStateChange({ 
                                  ...layoutState, 
                                  view: 'note-editor', 
                                  selectedNote: noteFilename, 
                                  selectedConcept: undefined 
                                })}
                              >
                                {title}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => handleNoteLinkRemove(noteFilename)}
                                aria-label={`Remove link to ${title}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-3">
                      No linked notes
                    </div>
                  )}
                </div>
              </>
            )
          ) : (
            <div className="text-sm text-muted-foreground">
              Select a note or concept to see context information
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}