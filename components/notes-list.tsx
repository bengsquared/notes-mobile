"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Camera, Video, Mic, MapPin, Trash2, Edit } from "lucide-react"
import { getAllNotes, deleteNote, type Note } from "@/lib/notes-storage"
import ComposeNote from "@/components/compose-note"

export default function NotesList() {
  const [notes, setNotes] = useState<Note[]>([])
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)

  const handleEdit = (note: Note) => {
    setEditingNoteId(note.id)
  }

  const handleEditComplete = () => {
    setEditingNoteId(null)
    setNotes(getAllNotes())
  }

  useEffect(() => {
    setNotes(getAllNotes())
  }, [])

  const handleDelete = (id: string) => {
    deleteNote(id)
    setNotes(getAllNotes())
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No notes yet. Create your first note!</p>
      </div>
    )
  }

  if (editingNoteId) {
    const editingNote = notes.find((note) => note.id === editingNoteId)
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit Note</h2>
          <Button variant="outline" size="sm" onClick={() => setEditingNoteId(null)}>
            Back to List
          </Button>
        </div>
        <ComposeNote onNoteCreated={handleEditComplete} editingNote={editingNote} onEditComplete={handleEditComplete} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <Card key={note.id}>
          <CardContent className="p-4">
            {/* Note Text */}
            {note.text && <p className="text-gray-900 mb-3 whitespace-pre-wrap">{note.text}</p>}

            {/* Attachments */}
            {note.attachments.length > 0 && (
              <div className="space-y-2 mb-3">
                {note.attachments.map((attachment, index) => (
                  <div key={index} className="border rounded p-2">
                    {attachment.type === "photo" && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Camera className="w-4 h-4" />
                          <span className="text-sm text-gray-600">Photo</span>
                        </div>
                        <img
                          src={attachment.data || "/placeholder.svg"}
                          alt="Note attachment"
                          className="max-w-full h-auto rounded"
                        />
                      </div>
                    )}
                    {attachment.type === "video" && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Video className="w-4 h-4" />
                          <span className="text-sm text-gray-600">Video</span>
                        </div>
                        <video src={attachment.data} controls className="max-w-full h-auto rounded" />
                      </div>
                    )}
                    {attachment.type === "audio" && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Mic className="w-4 h-4" />
                          <span className="text-sm text-gray-600">Audio Recording</span>
                        </div>
                        <audio src={attachment.data} controls className="w-full" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Location */}
            {note.location && (
              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                <MapPin className="w-4 h-4" />
                <span>
                  {note.location.lat.toFixed(6)}, {note.location.lng.toFixed(6)}
                </span>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">{formatDate(note.createdAt)}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(note)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(note.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
