
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, ChevronLeft, Inbox, FileText, Pin, Clock, Hash, Plus, Settings, Smartphone } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog'
import { useData, useConcepts, useIdeas, usePinnedItems, useRecentNotes } from '../contexts/DataContext'
import type { LayoutState } from './main-layout'

interface NavigationSidebarProps {
  layoutState: LayoutState
  onStateChange: (state: LayoutState) => void
  onToggleCollapse?: () => void
}

export function NavigationSidebar({ layoutState, onStateChange, onToggleCollapse }: NavigationSidebarProps) {
  const [conceptsExpanded, setConceptsExpanded] = useState(true)
  const [pinnedExpanded, setPinnedExpanded] = useState(true)
  const [recentExpanded, setRecentExpanded] = useState(false)
  const [newConceptName, setNewConceptName] = useState('')
  const [createConceptDialogOpen, setCreateConceptDialogOpen] = useState(false)
  
  // Data from provider
  const { concepts } = useConcepts()
  const { ideas } = useIdeas()
  const { pinnedItems } = usePinnedItems()
  const { recentNotes } = useRecentNotes()
  const { createConcept } = useData()

  // Update layout state with inbox count
  useEffect(() => {
    onStateChange({ ...layoutState, inboxCount: ideas.length })
  }, [ideas.length])


  const handleNavigation = (view: 'inbox' | 'notes' | 'settings' | 'concepts-list' | 'pinned-list' | 'recent-notes-list' | 'transfer') => {
    onStateChange({ ...layoutState, view, selectedNote: undefined, selectedConcept: undefined })
  }

  const handleConceptClick = (concept: string) => {
    onStateChange({ ...layoutState, view: 'concept-editor', selectedConcept: concept, selectedNote: undefined })
  }

  const handleNoteClick = (noteFilename: string) => {
    onStateChange({ ...layoutState, view: 'note-editor', selectedNote: noteFilename, selectedConcept: undefined })
  }

  const handleCreateConcept = async () => {
    if (!newConceptName.trim()) return
    
    try {
      await createConcept(newConceptName.trim())
      setNewConceptName('')
      setCreateConceptDialogOpen(false)
      // Navigate to the new concept
      handleConceptClick(newConceptName.trim())
    } catch (error) {
      console.error('Error creating concept:', error)
    }
  }

  const createNewNote = async () => {
    try {
      // Create a new idea (unprocessed thought) in inbox
      const newIdea = await window.electronAPI.ideas.create(
        '', // Start with empty content so user can immediately start typing
        {
          processed: false
        }
      )
      
      // Reload ideas to get the updated list with the new idea
      const updatedIdeas = await window.electronAPI.ideas.list()
      
      // Find the index of the newly created idea
      const newIdeaIndex = updatedIdeas.findIndex((idea: any) => idea.filename === newIdea.filename)
      
      // Navigate to inbox and focus on the new idea
      onStateChange({ 
        ...layoutState, 
        view: 'inbox',
        inboxNotes: updatedIdeas,
        inboxCurrentIndex: newIdeaIndex >= 0 ? newIdeaIndex : 0,
        inboxCount: updatedIdeas.length
      })
    } catch (error) {
      console.error('Error creating new idea:', error)
    }
  }

  return (
    <div className="h-full border-r bg-background flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Notes</h2>
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              onClick={createNewNote}
              aria-label="Create new note"
            >
              <Plus className="h-4 w-4" />
            </Button>
            {onToggleCollapse && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={onToggleCollapse}
                aria-label="Collapse navigation sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {/* Inbox */}
          <Button
            variant={layoutState.view === 'inbox' ? 'secondary' : 'ghost'}
            className="w-full justify-start grid grid-cols-[12px_20px_1fr] gap-2 items-center"
            onClick={() => handleNavigation('inbox')}
          >
            <div></div>
            <Inbox className="h-4 w-4" />
            <span className="flex items-center gap-2">
              Inbox
              {ideas.length > 0 && (
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                  {ideas.length}
                </span>
              )}
            </span>
          </Button>

          {/* All Notes */}
          <Button
            variant={layoutState.view === 'notes' ? 'secondary' : 'ghost'}
            className="w-full justify-start grid grid-cols-[12px_20px_1fr] gap-2 items-center"
            onClick={() => handleNavigation('notes')}
          >
            <div></div>
            <FileText className="h-4 w-4" />
            <span className='truncate text-left'>All Notes</span>
          </Button>

          {/* Pinned */}
          <Collapsible
            open={pinnedExpanded}
            onOpenChange={setPinnedExpanded}
          >
            <div className="flex w-full items-center">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost"
                  size="sm"
                  className="w-6 h-auto p-0 flex items-center justify-center shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPinnedExpanded(!pinnedExpanded)
                  }}
                >
                  {pinnedExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <Button 
                variant={layoutState.view === 'pinned-list' ? 'secondary' : 'ghost'} 
                className="flex-1 justify-start flex items-center gap-2 px-2"
                onClick={() => handleNavigation('pinned-list')}
              >
                <Pin className="h-4 w-4" />
                <span className="flex items-center gap-2">
                  Pinned
                  {(pinnedItems.notes.length + pinnedItems.concepts.length) > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {pinnedItems.notes.length + pinnedItems.concepts.length}
                    </span>
                  )}
                </span>
              </Button>
            </div>
            <CollapsibleContent className="space-y-1">
              {pinnedItems.notes.map((noteFilename) => (
                <Button
                  key={noteFilename}
                  variant="ghost"
                  className="w-full justify-start text-sm h-auto py-1 overflow-hidden grid grid-cols-[12px_20px_1fr] gap-2 items-center"
                  onClick={() => handleNoteClick(noteFilename)}
                >
                  <div></div>
                  <FileText className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate text-left">{noteFilename.replace('.txt', '')}</span>
                </Button>
              ))}
              {pinnedItems.concepts.map((concept) => (
                <Button
                  key={concept}
                  variant="ghost"
                  className="w-full justify-start text-sm h-auto py-1 overflow-hidden grid grid-cols-[12px_20px_1fr] gap-2 items-center"
                  onClick={() => handleConceptClick(concept)}
                >
                  <div></div>
                  <Hash className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate text-left">{concept}</span>
                </Button>
              ))}
              {(pinnedItems.notes.length + pinnedItems.concepts.length) === 0 && (
                <div className="text-xs text-muted-foreground grid grid-cols-[12px_20px_1fr] gap-2 py-2">
                  <div></div>
                  <div></div>
                  <span>No pinned items</span>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Recent Notes */}
          <Collapsible
            open={recentExpanded}
            onOpenChange={setRecentExpanded}
          >
            <div className="flex w-full items-center">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost"
                  size="sm"
                  className="w-6 h-auto p-0 flex items-center justify-center shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRecentExpanded(!recentExpanded)
                  }}
                >
                  {recentExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <Button 
                variant={layoutState.view === 'recent-notes-list' ? 'secondary' : 'ghost'} 
                className="flex-1 justify-start text-left flex items-center gap-2 px-2"
                onClick={() => handleNavigation('recent-notes-list')}
              >
                <Clock className="h-4 w-4" />
                <span>Recent Notes</span>
              </Button>
            </div>
            <CollapsibleContent className="space-y-1">
              {recentNotes.map((note) => (
                <Button
                  key={note.filename}
                  variant="ghost"
                  className="w-full justify-start text-sm h-auto py-1 overflow-hidden grid grid-cols-[12px_20px_1fr] gap-2 items-center"
                  onClick={() => handleNoteClick(note.filename)}
                >
                  <div></div>
                  <FileText className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate text-left">
                    {note.metadata.title || note.filename.replace('.txt', '')}
                  </span>
                </Button>
              ))}
              {recentNotes.length === 0 && (
                <div className="text-xs text-muted-foreground grid grid-cols-[12px_20px_1fr] gap-2 py-2">
                  <div></div>
                  <div></div>
                  <span>No recent notes</span>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Concepts */}
          <Collapsible
            open={conceptsExpanded}
            onOpenChange={setConceptsExpanded}
          >
            <div className="flex w-full items-center">
              <CollapsibleTrigger asChild>
                <Button 
                  variant="ghost"
                  size="sm"
                  className="w-6 h-auto p-0 flex items-center justify-center shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    setConceptsExpanded(!conceptsExpanded)
                  }}
                >
                  {conceptsExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <Button 
                variant={layoutState.view === 'concepts-list' ? 'secondary' : 'ghost'} 
                className="flex-1 justify-start flex items-center gap-2 px-2"
                onClick={() => handleNavigation('concepts-list')}
              >
                <Hash className="h-4 w-4" />
                <span className="truncate text-left">Concepts</span>
              </Button>
            </div>
            <CollapsibleContent className="space-y-1">
              {concepts.slice(0, 10).map((concept) => (
                <Button
                  key={concept.name}
                  variant="ghost"
                  className="w-full justify-start text-sm h-auto py-1 overflow-hidden grid grid-cols-[12px_20px_1fr] gap-2 items-center"
                  onClick={() => handleConceptClick(concept.name)}
                >
                  <div></div>
                  <Hash className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate text-left">{concept.name}</span>
                </Button>
              ))}
              {concepts.length > 10 && (
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sm text-muted-foreground h-auto py-1 grid grid-cols-[12px_20px_1fr] gap-2 items-center"
                  onClick={() => handleNavigation('concepts-list')}
                >
                  <div></div>
                  <div></div>
                  <span className="truncate text-left">View all {concepts.length} concepts...</span>
                </Button>
              )}
              {concepts.length === 0 && (
                <div className="text-xs text-muted-foreground grid grid-cols-[12px_20px_1fr] gap-2 py-2">
                  <div></div>
                  <div></div>
                  <span>No concepts yet</span>
                </div>
              )}
              
              {/* New Concept Button - moved below the list */}
              <Dialog open={createConceptDialogOpen} onOpenChange={setCreateConceptDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start text-left text-xs text-muted-foreground h-auto py-1 grid grid-cols-[12px_20px_1fr] gap-2 items-center"
                  >
                    <div></div>
                    <Plus className="h-3 w-3" />
                    <span>New concept...</span>
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
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
      
      {/* Transfer and Settings at bottom */}
      <div className="p-2 border-t space-y-1">
        <Button
          variant={layoutState.view === 'transfer' ? 'secondary' : 'ghost'}
          className="w-full justify-start"
          onClick={() => handleNavigation('transfer')}
        >
          <Smartphone className="mr-2 h-4 w-4" />
          Transfer
        </Button>
        <Button
          variant={layoutState.view === 'settings' ? 'secondary' : 'ghost'}
          className="w-full justify-start"
          onClick={() => handleNavigation('settings')}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  )
}