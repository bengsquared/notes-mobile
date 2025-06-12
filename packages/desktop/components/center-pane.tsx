'use client'

import { InboxProcessor } from './inbox-processor'
import { NotesList } from './notes-list'
import { NoteEditor } from './note-editor-new'
import { ConceptEditor } from './concept-editor'
import { ConceptNotesList } from './concept-notes-list'
import { SettingsPage } from './settings-page'
import { RecentNotesList } from './recent-notes-list'
import { PinnedList } from './pinned-list'
import { ConceptsList } from './concepts-list'
import type { LayoutState } from './main-layout'

interface CenterPaneProps {
  layoutState: LayoutState
  onStateChange: (state: LayoutState) => void
}

export function CenterPane({ layoutState, onStateChange }: CenterPaneProps) {
  if (layoutState.view === 'inbox') {
    return (
      <InboxProcessor 
        layoutState={layoutState}
        onStateChange={onStateChange}
      />
    )
  }

  if (layoutState.view === 'settings') {
    return (
      <SettingsPage 
        onBack={() => onStateChange({ ...layoutState, view: 'notes', selectedNote: undefined, selectedConcept: undefined })}
      />
    )
  }

  if (layoutState.view === 'note-editor' && layoutState.selectedNote) {
    return (
      <NoteEditor 
        noteFilename={layoutState.selectedNote}
        onBack={() => onStateChange({ ...layoutState, view: 'notes', selectedNote: undefined, selectedConcept: undefined })}
        onStateChange={onStateChange}
      />
    )
  }

  if (layoutState.view === 'concept-editor' && layoutState.selectedConcept) {
    return (
      <ConceptNotesList 
        conceptName={layoutState.selectedConcept}
        onBack={() => onStateChange({ ...layoutState, view: 'notes', selectedNote: undefined, selectedConcept: undefined })}
        onNoteSelect={(noteFilename) => 
          onStateChange({ ...layoutState, view: 'note-editor', selectedNote: noteFilename, selectedConcept: undefined })
        }
        onStateChange={onStateChange}
      />
    )
  }

  // Dedicated list views
  if (layoutState.view === 'concepts-list') {
    return (
      <ConceptsList 
        layoutState={layoutState}
        onConceptSelect={(conceptName) => 
          onStateChange({ ...layoutState, view: 'concept-editor', selectedConcept: conceptName, selectedNote: undefined })
        }
      />
    )
  }

  if (layoutState.view === 'pinned-list') {
    return (
      <PinnedList 
        layoutState={layoutState}
        onNoteSelect={(noteFilename) => 
          onStateChange({ ...layoutState, view: 'note-editor', selectedNote: noteFilename, selectedConcept: undefined })
        }
        onConceptSelect={(conceptName) => 
          onStateChange({ ...layoutState, view: 'concept-editor', selectedConcept: conceptName, selectedNote: undefined })
        }
      />
    )
  }

  if (layoutState.view === 'recent-notes-list') {
    return (
      <RecentNotesList 
        layoutState={layoutState}
        onNoteSelect={(noteFilename) => 
          onStateChange({ ...layoutState, view: 'note-editor', selectedNote: noteFilename, selectedConcept: undefined })
        }
      />
    )
  }

  return (
    <NotesList 
      layoutState={layoutState}
      onNoteSelect={(noteFilename) => 
        onStateChange({ ...layoutState, view: 'note-editor', selectedNote: noteFilename, selectedConcept: undefined })
      }
      onStateChange={onStateChange}
    />
  )
}