'use client'

import React, { useState } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from './ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable'
import { NavigationSidebar } from './navigation-sidebar'
import { InboxSidebar } from './inbox-sidebar'
import { CenterPane } from './center-pane'
import { UnifiedContextSidebar } from './unified-context-sidebar'
import { useData, useIdeas } from '../contexts/DataContext'
import { dataHandler } from '../src/lib/data-handler'
import type { Note, Concept } from '@notes-app/shared'

export interface LayoutState {
  view: 'inbox' | 'notes' | 'note-editor' | 'settings' | 'concepts-list' | 'pinned-list' | 'recent-notes-list' | 'concept-editor'
  selectedNote?: string
  selectedConcept?: string
  inboxCount: number
  inboxNotes?: Note[]
  inboxCurrentIndex?: number
}

export function MainLayout() {
  const [layoutState, setLayoutState] = useState<LayoutState>({
    view: 'notes',
    inboxCount: 0
  })
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useState(false)
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false)
  const { addNoteConcept, removeNoteConcept, notes } = useData()
  const { attachConceptToIdea, removeConceptFromIdea, linkNoteToIdea, removeNoteLinkFromIdea, loadIdeas, ideas } = useIdeas()
  
  // Sync DataContext ideas with layout state for inbox
  React.useEffect(() => {
    if (layoutState.view === 'inbox') {
      setLayoutState(prev => {
        // Handle empty inbox case
        if (ideas.length === 0) {
          return {
            ...prev,
            inboxNotes: [],
            inboxCount: 0,
            inboxCurrentIndex: undefined
          }
        }
        
        // Handle non-empty inbox
        let newIndex = prev.inboxCurrentIndex;
        
        // If no index set or current index is out of bounds, default to first item
        if (newIndex === undefined || newIndex >= ideas.length) {
          newIndex = 0;
        }
        
        return {
          ...prev,
          inboxNotes: ideas,
          inboxCount: ideas.length,
          inboxCurrentIndex: newIndex
        }
      })
    }
  }, [ideas, layoutState.view])
  
  // Get the current note object from the filename
  const currentNote = layoutState.selectedNote 
    ? notes.find(n => n.filename === layoutState.selectedNote) || null
    : null

  // Get the current inbox note
  const currentInboxNote = layoutState.view === 'inbox' && layoutState.inboxNotes && layoutState.inboxCurrentIndex !== undefined
    ? layoutState.inboxNotes[layoutState.inboxCurrentIndex] || null
    : null


  // Auto-collapse right sidebar for list views that don't need context
  const shouldCollapseRightSidebar = (view: LayoutState['view']) => {
    return ['notes', 'concepts-list', 'pinned-list', 'recent-notes-list'].includes(view)
  }

  // Auto-collapse right sidebar when switching to non-contextual views
  React.useEffect(() => {
    if (shouldCollapseRightSidebar(layoutState.view)) {
      setRightSidebarCollapsed(true)
    } else if (layoutState.view === 'note-editor' || layoutState.view === 'concept-editor' || layoutState.view === 'inbox') {
      // For editors and inbox, show context sidebar by default (user can still manually collapse)
      setRightSidebarCollapsed(false)
    }
  }, [layoutState.view])


  // For concept view, get the current concept
  const [currentConcept, setCurrentConcept] = useState<Concept | null>(null)
  
  // Load concept when viewing concept editor
  React.useEffect(() => {
    if (layoutState.view === 'concept-editor' && layoutState.selectedConcept) {
      const loadConcept = async () => {
        try {
          console.log('🏗️ MainLayout - About to load concept:', layoutState.selectedConcept)
          const concept = await dataHandler.loadConcept(layoutState.selectedConcept!)
          console.log('🏗️ MainLayout - Loaded concept for context sidebar:', concept.name)
          console.log('🏗️ MainLayout - Full concept object:', concept)
          console.log('🏗️ MainLayout - Concept metadata keys:', Object.keys(concept.metadata))
          console.log('🏗️ MainLayout - relatedConcepts specifically:', concept.metadata.relatedConcepts)
          setCurrentConcept(concept)
        } catch (error) {
          console.error('Error loading concept for context:', error)
          setCurrentConcept(null)
        }
      }
      loadConcept()
    } else {
      setCurrentConcept(null)
    }
  }, [layoutState.view, layoutState.selectedConcept])

  // Handler for concept changes from context sidebar
  const handleConceptChange = (updatedConcept: any) => {
    setCurrentConcept(updatedConcept)
  }

  // Settings view - full screen without any sidebars
  if (layoutState.view === 'settings') {
    return (
      <div className="h-screen">
        <CenterPane 
          layoutState={layoutState}
          onStateChange={setLayoutState}
        />
      </div>
    )
  }

  return (
    <div className="h-screen flex">
      {/* Left sidebar - collapsed or expanded */}
      {leftSidebarCollapsed ? (
        <div className="w-12 border-r flex-shrink-0 bg-background flex flex-col items-center py-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLeftSidebarCollapsed(false)}
            className="w-8 h-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel 
            defaultSize={16} 
            minSize={12} 
            maxSize={25}
            style={{ minWidth: '12rem' }}
            onResize={(size) => {
              // Auto-collapse if user tries to resize below minimum readable width
              if (size < 12) {
                setLeftSidebarCollapsed(true)
              }
            }}
          >
            {layoutState.view === 'inbox' ? (
              <InboxSidebar 
                inboxNotes={layoutState.inboxNotes || []}
                currentIndex={layoutState.inboxCurrentIndex || 0}
                onJumpToNote={(index) => setLayoutState(prev => ({ ...prev, inboxCurrentIndex: index }))}
                onRefreshInbox={async () => {
                  // Reload inbox notes when requested using DataContext
                  try {
                    await loadIdeas()
                    // Ideas will be updated automatically through DataContext
                  } catch (error) {
                    console.error('Error refreshing inbox:', error)
                  }
                }}
                onCreateAndFocus={async (newIdea: Note) => {
                  // Reload ideas and focus on the newly created one using DataContext
                  try {
                    await loadIdeas()
                    const newIdeaIndex = ideas.findIndex((idea: any) => idea.filename === newIdea.filename)
                    setLayoutState(prev => ({ 
                      ...prev, 
                      inboxCurrentIndex: newIdeaIndex >= 0 ? newIdeaIndex : 0
                    }))
                  } catch (error) {
                    console.error('Error refreshing and focusing on new idea:', error)
                  }
                }}
              />
            ) : (
              <NavigationSidebar 
                layoutState={layoutState}
                onStateChange={setLayoutState}
                onToggleCollapse={() => setLeftSidebarCollapsed(true)}
              />
            )}
          </ResizablePanel>
          
          <ResizableHandle />
          
          {/* Center Content Area */}
          <ResizablePanel defaultSize={rightSidebarCollapsed ? 84 : 56} minSize={40}>
            <CenterPane 
              layoutState={layoutState}
              onStateChange={setLayoutState}
            />
          </ResizablePanel>
          
          {!rightSidebarCollapsed && (
            <>
              <ResizableHandle />
              
              {/* Right Context Sidebar */}
              <ResizablePanel 
                defaultSize={28} 
                minSize={18} 
                maxSize={35}
                style={{ minWidth: '11rem' }}
                onResize={(size) => {
                  // Auto-collapse if user tries to resize below minimum readable width
                  if (size < 18) {
                    setRightSidebarCollapsed(true)
                  }
                }}
              >
                <UnifiedContextSidebar 
                  layoutState={layoutState}
                  onStateChange={setLayoutState}
                  onToggleCollapse={() => setRightSidebarCollapsed(true)}
                  currentItem={
                    layoutState.view === 'inbox' ? currentInboxNote : 
                    layoutState.view === 'concept-editor' ? currentConcept : 
                    currentNote
                  }
                  onConceptAttach={async (conceptName: string) => {
                    if (layoutState.view === 'inbox' && currentInboxNote) {
                      await attachConceptToIdea(currentInboxNote.filename, conceptName)
                      // Update the inbox notes state with the new concept
                      const updatedNotes = layoutState.inboxNotes?.map(note => 
                        note.filename === currentInboxNote.filename 
                          ? { ...note, metadata: { ...note.metadata, concepts: [...(note.metadata.concepts || []), conceptName] } }
                          : note
                      )
                      setLayoutState(prev => ({ ...prev, inboxNotes: updatedNotes }))
                    } else if (currentNote) {
                      await addNoteConcept(currentNote.filename, conceptName)
                    }
                  }}
                  onConceptRemove={async (conceptName: string) => {
                    if (layoutState.view === 'inbox' && currentInboxNote) {
                      await removeConceptFromIdea(currentInboxNote.filename, conceptName)
                      // Update the inbox notes state without the concept
                      const updatedNotes = layoutState.inboxNotes?.map(note => 
                        note.filename === currentInboxNote.filename 
                          ? { ...note, metadata: { ...note.metadata, concepts: (note.metadata.concepts || []).filter((c: string) => c !== conceptName) } }
                          : note
                      )
                      setLayoutState(prev => ({ ...prev, inboxNotes: updatedNotes }))
                    } else if (currentNote) {
                      await removeNoteConcept(currentNote.filename, conceptName)
                    }
                  }}
                  onNoteLink={async (noteFilename: string) => {
                    if (layoutState.view === 'inbox' && currentInboxNote) {
                      await linkNoteToIdea(currentInboxNote.filename, noteFilename)
                      // Update the inbox notes state with the new link
                      const updatedNotes = layoutState.inboxNotes?.map(note => 
                        note.filename === currentInboxNote.filename 
                          ? { ...note, metadata: { ...note.metadata, links: [...(note.metadata.links || []), noteFilename] } }
                          : note
                      )
                      setLayoutState(prev => ({ ...prev, inboxNotes: updatedNotes }))
                    } else if (currentNote) {
                      console.log('🔗 Would link notes:', currentNote.filename, '<->', noteFilename)
                    }
                  }}
                  onNoteLinkRemove={async (noteFilename: string) => {
                    if (layoutState.view === 'inbox' && currentInboxNote) {
                      await removeNoteLinkFromIdea(currentInboxNote.filename, noteFilename)
                      // Update the inbox notes state without the link
                      const updatedNotes = layoutState.inboxNotes?.map(note => 
                        note.filename === currentInboxNote.filename 
                          ? { ...note, metadata: { ...note.metadata, links: (note.metadata.links || []).filter((l: string) => l !== noteFilename) } }
                          : note
                      )
                      setLayoutState(prev => ({ ...prev, inboxNotes: updatedNotes }))
                    } else if (currentNote) {
                      console.log('🔗 Would unlink notes:', currentNote.filename, '<->', noteFilename)
                    }
                  }}
                  onItemChange={
                    layoutState.view === 'concept-editor' ? handleConceptChange : 
                    layoutState.view === 'inbox' ? (updatedItem: any) => {
                      // Update the inbox notes state with the updated item
                      const updatedNotes = layoutState.inboxNotes?.map(note => 
                        note.filename === updatedItem.filename ? updatedItem : note
                      )
                      setLayoutState(prev => ({ ...prev, inboxNotes: updatedNotes }))
                    } : undefined
                  }
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      )}
      
      {/* Right sidebar collapsed toggle - only when left sidebar is expanded */}
      {!leftSidebarCollapsed && rightSidebarCollapsed && (
        <div className="w-12 border-l flex-shrink-0 bg-background flex flex-col items-center py-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setRightSidebarCollapsed(false)}
            className="w-8 h-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      {/* Content area when left sidebar is collapsed */}
      {leftSidebarCollapsed && (
        <div className="flex-1 flex">
          <div className="flex-1">
            <CenterPane 
              layoutState={layoutState}
              onStateChange={setLayoutState}
            />
          </div>
          
          {/* Right sidebar when left is collapsed */}
          {!rightSidebarCollapsed ? (
            <div className="w-80 border-l" style={{ minWidth: '11rem' }}>
              <UnifiedContextSidebar 
                layoutState={layoutState}
                onStateChange={setLayoutState}
                onToggleCollapse={() => setRightSidebarCollapsed(true)}
                currentItem={
                  layoutState.view === 'concept-editor' ? currentConcept : 
                  currentNote
                }
                onConceptAttach={async (conceptName: string) => {
                  if (currentNote) {
                    await addNoteConcept(currentNote.filename, conceptName)
                  }
                }}
                onConceptRemove={async (conceptName: string) => {
                  if (currentNote) {
                    await removeNoteConcept(currentNote.filename, conceptName)
                  }
                }}
                onNoteLink={async (noteFilename: string) => {
                  if (currentNote) {
                    console.log('🔗 Would link notes:', currentNote.filename, '<->', noteFilename)
                  }
                }}
                onNoteLinkRemove={async (noteFilename: string) => {
                  if (currentNote) {
                    console.log('🔗 Would unlink notes:', currentNote.filename, '<->', noteFilename)
                  }
                }}
                onItemChange={
                  layoutState.view === 'concept-editor' ? handleConceptChange : undefined
                }
              />
            </div>
          ) : (
            <div className="w-12 border-l flex-shrink-0 bg-background flex flex-col items-center py-4">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setRightSidebarCollapsed(false)}
                className="w-8 h-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}