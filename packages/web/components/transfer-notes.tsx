"use client"

import { useState, useEffect } from "react"
import { QRP2PTransfer } from "@/components/qr-p2p-transfer"
import ExportNotes from "@/components/export-notes"
import { getAllNotes } from "@/lib/notes-storage"

// Transform storage notes to transfer format
interface TransferNote {
  id: string
  content: string
  createdAt: string
  location?: {
    lat: number
    lng: number
  }
}

export default function TransferNotes() {
  const [notes, setNotes] = useState<TransferNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const allNotes = getAllNotes()
        // Transform storage notes to transfer format
        const transferNotes: TransferNote[] = allNotes.map(note => ({
          id: note.id,
          content: note.text, // Map 'text' to 'content'
          createdAt: note.createdAt,
          location: note.location
        }))
        setNotes(transferNotes)
      } catch (error) {
        console.error('Error loading notes:', error)
      } finally {
        setLoading(false)
      }
    }

    loadNotes()
  }, [])

  const handleTransferComplete = () => {
    // Optionally reload notes or show a success message
    console.log('Transfer completed successfully')
  }

  const handleNotesDeleted = () => {
    // Reload notes after deletion
    setLoading(true)
    const loadNotes = async () => {
      try {
        const allNotes = getAllNotes()
        const transferNotes: TransferNote[] = allNotes.map(note => ({
          id: note.id,
          content: note.text,
          createdAt: note.createdAt,
          location: note.location
        }))
        setNotes(transferNotes)
      } catch (error) {
        console.error('Error loading notes:', error)
      } finally {
        setLoading(false)
      }
    }
    loadNotes()
  }

  if (loading) {
    return <div className="text-center">Loading notes...</div>
  }

  return (
    <div className="space-y-4">
      <QRP2PTransfer 
        notes={notes} 
        onTransferComplete={handleTransferComplete}
        onNotesDeleted={handleNotesDeleted}
      />
      <ExportNotes />
    </div>
  )
}
