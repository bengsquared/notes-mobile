
import { useState } from 'react'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { EmptyState } from './ui/empty-state'
import { ConceptListItem } from './concept-list-item'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog'
import { useSearch } from '../hooks/use-search'
import { Search, Hash, Plus } from 'lucide-react'
import { useConcepts } from '../contexts/DataContext'
import type { LayoutState } from './main-layout'

interface ConceptsListProps {
  layoutState: LayoutState
  onConceptSelect: (conceptName: string) => void
}

export function ConceptsList({ onConceptSelect }: ConceptsListProps) {
  const [newConceptName, setNewConceptName] = useState('')
  const [createConceptDialogOpen, setCreateConceptDialogOpen] = useState(false)
  
  // Data from provider
  const { concepts, loading, createConcept, deleteConcept } = useConcepts()

  const handleDeleteConcept = async (conceptName: string): Promise<void> => {
    await deleteConcept(conceptName)
  }

  // Search functionality
  const conceptSearch = useSearch({
    items: concepts,
    searchFields: ['name', 'content'],
    filterFn: (concept, query) => {
      const searchLower = query.toLowerCase()
      return (
        concept.name.toLowerCase().includes(searchLower) ||
        concept.content.toLowerCase().includes(searchLower)
      )
    }
  })

  const handleCreateConcept = async () => {
    if (!newConceptName.trim()) return
    
    try {
      await createConcept(newConceptName.trim())
      setNewConceptName('')
      setCreateConceptDialogOpen(false)
      // Navigate to the new concept
      onConceptSelect(newConceptName.trim())
    } catch (error) {
      console.error('Error creating concept:', error)
    }
  }


  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div>Loading concepts...</div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Hash className="h-5 w-5 mr-2 text-muted-foreground" />
            <h1 className="text-xl font-bold">Concepts</h1>
            <span className="ml-2 text-sm text-muted-foreground">
              ({concepts.length})
            </span>
          </div>
          
          <Dialog open={createConceptDialogOpen} onOpenChange={setCreateConceptDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Concept
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
              </div>
              <DialogFooter>
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
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Search */}
        {concepts.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search concepts..."
              value={conceptSearch.query}
              onChange={(e) => conceptSearch.setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
      </div>

      {/* Concepts List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {conceptSearch.filteredItems.length === 0 ? (
            concepts.length === 0 ? (
              <EmptyState
                icon={Hash}
                title="No concepts yet"
                description="Create your first concept to organize your notes"
              >
                <Button onClick={() => setCreateConceptDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Concept
                </Button>
              </EmptyState>
            ) : (
              <EmptyState
                icon={Search}
                title="No concepts found"
                description={`No concepts match "${conceptSearch.query}"`}
              />
            )
          ) : (
            conceptSearch.filteredItems.map((concept) => (
              <ConceptListItem
                key={concept.name}
                concept={concept}
                onSelect={onConceptSelect}
                onDelete={handleDeleteConcept}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}