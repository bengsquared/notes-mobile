'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Plus, Edit, Link2, Tag, FolderOpen } from 'lucide-react'
import { DeepNote, Collection } from '@notes-app/shared'

export function DeepNotesManager() {
  const [notes, setNotes] = useState<DeepNote[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNote, setSelectedNote] = useState<DeepNote | null>(null)
  const [showNoteDialog, setShowNoteDialog] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [editMode, setEditMode] = useState(false)

  // Load notes on mount
  useEffect(() => {
    loadNotes()
  }, [])

  const loadNotes = async () => {
    if (!window.electronAPI) return
    
    try {
      const files = await window.electronAPI.listNotes()
      const loadedNotes: DeepNote[] = []
      
      for (const file of files) {
        if (!file.includes('quick-note-')) {
          const content = await window.electronAPI.loadNote(file)
          // Parse the note format
          const lines = content.split('\n')
          const title = lines[0]?.replace('Title: ', '') || ''
          const tags = lines[1]?.replace('Tags: ', '').split(', ').filter(Boolean) || []
          const noteContent = lines.slice(4).join('\n')
          
          loadedNotes.push({
            id: file.replace('.txt', '').split('-')[0],
            title,
            content: noteContent,
            tags,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            processed: true,
            linkedNotes: [],
            collections: []
          })
        }
      }
      
      setNotes(loadedNotes)
    } catch (error) {
      console.error('Failed to load notes:', error)
    }
  }

  const filteredNotes = notes.filter(note => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    note.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const openNote = (note: DeepNote) => {
    setSelectedNote(note)
    setShowNoteDialog(true)
    setEditMode(false)
  }

  const saveNote = async () => {
    if (!selectedNote || !window.electronAPI) return

    const filename = `${selectedNote.id}-${selectedNote.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`
    const content = `Title: ${selectedNote.title}\nTags: ${selectedNote.tags?.join(', ') || ''}\nDate: ${selectedNote.createdAt}\n\n${selectedNote.content}`
    
    await window.electronAPI.saveNote(filename, content)
    
    setNotes(notes.map(n => n.id === selectedNote.id ? selectedNote : n))
    setShowNoteDialog(false)
    setEditMode(false)
  }

  return (
    <>
      <div className="h-full flex">
        <div className="flex-1 flex flex-col p-4">
          <div className="mb-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Deep Notes</h2>
              <Button onClick={() => {
                const newNote: DeepNote = {
                  id: Date.now().toString(),
                  title: 'New Note',
                  content: '',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  processed: true,
                  tags: [],
                  linkedNotes: [],
                  collections: []
                }
                setSelectedNote(newNote)
                setEditMode(true)
                setShowNoteDialog(true)
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New Note
              </Button>
            </div>
            
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="grid gap-4 md:grid-cols-2">
              {filteredNotes.map((note) => (
                <Card 
                  key={note.id} 
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => openNote(note)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{note.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                      {note.content}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {note.tags?.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                      {note.linkedNotes && note.linkedNotes.length > 0 && (
                        <div className="flex items-center gap-1">
                          <Link2 className="h-3 w-3" />
                          {note.linkedNotes.length}
                        </div>
                      )}
                      <div>{new Date(note.updatedAt).toLocaleDateString()}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="w-80 border-l p-4">
          <Tabs defaultValue="collections">
            <TabsList className="w-full">
              <TabsTrigger value="collections" className="flex-1">
                <FolderOpen className="h-4 w-4 mr-2" />
                Collections
              </TabsTrigger>
              <TabsTrigger value="tags" className="flex-1">
                <Tag className="h-4 w-4 mr-2" />
                Tags
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="collections">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Collections help organize related notes
                  </p>
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="tags">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="space-y-2">
                  {Array.from(new Set(notes.flatMap(n => n.tags || []))).map(tag => (
                    <Badge 
                      key={tag} 
                      variant="outline" 
                      className="mr-2 mb-2 cursor-pointer"
                      onClick={() => setSearchQuery(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              {editMode ? (
                <Input
                  value={selectedNote?.title || ''}
                  onChange={(e) => setSelectedNote(prev => prev ? {...prev, title: e.target.value} : null)}
                  className="text-lg font-semibold"
                />
              ) : (
                <span>{selectedNote?.title}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditMode(!editMode)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {editMode ? (
              <>
                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input
                    value={selectedNote?.tags?.join(', ') || ''}
                    onChange={(e) => setSelectedNote(prev => 
                      prev ? {...prev, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)} : null
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={selectedNote?.content || ''}
                    onChange={(e) => setSelectedNote(prev => prev ? {...prev, content: e.target.value} : null)}
                    className="min-h-[300px]"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap gap-1">
                  {selectedNote?.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="prose max-w-none">
                  <p className="whitespace-pre-wrap">{selectedNote?.content}</p>
                </div>
                {selectedNote?.linkedNotes && selectedNote.linkedNotes.length > 0 && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-semibold mb-2">Linked Notes</h4>
                    <div className="space-y-1">
                      {selectedNote.linkedNotes.map(id => {
                        const linkedNote = notes.find(n => n.id === id)
                        return linkedNote ? (
                          <Button
                            key={id}
                            variant="link"
                            className="h-auto p-0 justify-start"
                            onClick={() => openNote(linkedNote)}
                          >
                            {linkedNote.title}
                          </Button>
                        ) : null
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          
          <DialogFooter>
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button onClick={saveNote}>
                  Save
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowLinkDialog(true)}
              >
                <Link2 className="h-4 w-4 mr-2" />
                Link Notes
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}