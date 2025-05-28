'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2 } from 'lucide-react'
import { Note } from '@notes-app/shared'

export function QuickNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [currentNote, setCurrentNote] = useState('')

  const addNote = () => {
    if (currentNote.trim()) {
      const newNote: Note = {
        id: Date.now().toString(),
        content: currentNote,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setNotes([newNote, ...notes])
      setCurrentNote('')
      
      // Save to file system
      if (window.electronAPI) {
        const filename = `quick-note-${newNote.id}.txt`
        window.electronAPI.saveNote(filename, newNote.content)
      }
    }
  }

  const deleteNote = (id: string) => {
    setNotes(notes.filter(note => note.id !== id))
    if (window.electronAPI) {
      const filename = `quick-note-${id}.txt`
      window.electronAPI.deleteNote(filename)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle>Quick Notes</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Capture a quick thought..."
            value={currentNote}
            onChange={(e) => setCurrentNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) {
                addNote()
              }
            }}
            className="min-h-[100px]"
          />
          <Button 
            onClick={addNote} 
            disabled={!currentNote.trim()}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        </div>
        
        <Separator />
        
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {notes.map((note) => (
              <Card key={note.id} className="p-3">
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm flex-1">{note.content}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteNote(note.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}