'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { ScrollArea } from './ui/scroll-area'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Badge } from './ui/badge'
import { FileText, Trash2, Archive, Wifi, WifiOff, RefreshCw, ExternalLink } from 'lucide-react'
import { Note, DeepNote } from '@notes-app/shared'

declare global {
  interface Window {
    electronAPI?: {
      saveNote: (filename: string, content: string) => Promise<void>
    }
  }
}

interface InboxProps {
  notes: Note[]
  onProcessNote: (note: Note) => void
}

export function Inbox({ notes, onProcessNote }: InboxProps) {
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [showProcessDialog, setShowProcessDialog] = useState(false)
  const [title, setTitle] = useState('')
  const [tags, setTags] = useState('')
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')

  // Check RPC server status
  const checkRpcStatus = async () => {
    try {
      const response = await fetch('http://localhost:8080/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', params: {}, id: 1 })
      })
      setRpcStatus(response.ok ? 'connected' : 'disconnected')
    } catch {
      setRpcStatus('disconnected')
    }
  }

  useEffect(() => {
    checkRpcStatus()
    const interval = setInterval(checkRpcStatus, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [])

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
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Inbox</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {rpcStatus === 'connected' ? (
                  <Wifi className="h-4 w-4 text-green-600" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm text-muted-foreground">
                  RPC Server {rpcStatus === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={checkRpcStatus}
                title="Check connection status"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">Process your captured notes</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4">
            {notes.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No notes in inbox</p>
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Transfer notes from your web app to see them here
                  </p>
                  {rpcStatus === 'connected' ? (
                    <div className="space-y-2">
                      <Badge variant="outline" className="text-green-600">
                        <Wifi className="h-3 w-3 mr-1" />
                        RPC Server is running on port 8080
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        From your web app, click "Transfer to Desktop" to send notes here
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Badge variant="outline" className="text-red-600">
                        <WifiOff className="h-3 w-3 mr-1" />
                        RPC Server not detected
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        Make sure the desktop app is running to receive notes
                      </p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('http://localhost:3000', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Web App
                  </Button>
                </div>
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
            <DialogDescription>
              Convert this note into a deep note with a title and tags for better organization.
            </DialogDescription>
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