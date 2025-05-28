'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { FileText, Trash2, Archive } from 'lucide-react'
import { Note, DeepNote } from '@notes-app/shared'

interface InboxProps {
  notes: Note[]
  onProcessNote: (note: Note) => void
}

export function Inbox({ notes, onProcessNote }: InboxProps) {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [showProcessDialog, setShowProcessDialog] = useState(false)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')

  const processNote = async () => {
    if (!selectedNote || !title.trim()) return

    const deepNote: DeepNote = {
      ...selectedNote,
      title: title.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      processed: true,
      linkedNotes: [],
      collections: []
    }

    // Save as deep note
    if (window.electronAPI) {
      const filename = `${deepNote.id}-${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`
      const content = `Title: ${deepNote.title}\nTags: ${deepNote.tags?.join(', ') || ''}\nDate: ${deepNote.createdAt}\n\n${deepNote.content}`
      await window.electronAPI.saveNote(filename, content)
    }

    onProcessNote(selectedNote)
    setShowProcessDialog(false)
    setSelectedNote(null)
    setTitle('')
    setTags('')
  }

  const discardNote = (note: Note) => {
    onProcessNote(note)
  }

  return (
    <>
      <div className="h-full flex flex-col p-4">
        <div className="mb-4">
          <h2 className="text-2xl font-bold">Inbox</h2>
          <p className="text-muted-foreground">Process your captured notes</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4">
            {notes.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No notes in inbox</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Transfer notes from your mobile app to see them here
                </p>
              </Card>
            ) : (
              notes.map((note) => (
                <Card key={note.id} className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <p className="text-sm">{note.content}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(note.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedNote(note)
                          setShowProcessDialog(true)
                        }}
                      >
                        <Archive className="h-4 w-4 mr-1" />
                        Process
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => discardNote(note)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Enter a title for this note"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma separated)</Label>
              <Input
                id="tags"
                placeholder="tag1, tag2, tag3"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={selectedNote?.content || ''}
                readOnly
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>
              Cancel
            </Button>
            <Button onClick={processNote} disabled={!title.trim()}>
              Save as Deep Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}