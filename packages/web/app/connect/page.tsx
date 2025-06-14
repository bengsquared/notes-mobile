'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { QRP2PTransfer } from '@/components/qr-p2p-transfer'
import { getAllNotes } from '@/lib/notes-storage'

interface TransferNote {
  id: string
  content: string
  createdAt: string
  location?: {
    lat: number
    lng: number
  }
}

export default function ConnectPage() {
  const searchParams = useSearchParams()
  const [notes, setNotes] = useState<TransferNote[]>([])
  const [loading, setLoading] = useState(true)
  const [autoConnecting, setAutoConnecting] = useState(false)
  
  // Get connection parameters from URL
  const ip = searchParams.get('ip')
  const port = searchParams.get('port')
  const pin = searchParams.get('pin')
  const version = searchParams.get('v')

  useEffect(() => {
    const loadNotes = async () => {
      try {
        const storageNotes = await getAllNotes()
        const transferNotes: TransferNote[] = storageNotes.map(note => ({
          id: note.id,
          content: note.text, // Map storage format to transfer format
          createdAt: note.createdAt,
          location: note.location
        }))
        setNotes(transferNotes)
      } catch (error) {
        console.error('Failed to load notes:', error)
      } finally {
        setLoading(false)
      }
    }

    loadNotes()
  }, [])

  const handleNotesDeleted = () => {
    // Reload notes after deletion
    setLoading(true)
    const loadNotes = async () => {
      try {
        const storageNotes = await getAllNotes()
        const transferNotes: TransferNote[] = storageNotes.map(note => ({
          id: note.id,
          content: note.text,
          createdAt: note.createdAt,
          location: note.location
        }))
        setNotes(transferNotes)
      } catch (error) {
        console.error('Failed to load notes:', error)
      } finally {
        setLoading(false)
      }
    }
    loadNotes()
  }

  useEffect(() => {
    // If we have connection parameters from QR scan, auto-connect
    if (ip && port && pin && !loading && !autoConnecting) {
      console.log('📱 Connect Page: Auto-connecting with QR parameters:', { ip, port, pin })
      setAutoConnecting(true)
      
      // TODO: Trigger auto-connection with QR parameters
      // This would need to be implemented in the QRP2PTransfer component
    }
  }, [ip, port, pin, loading, autoConnecting])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p>Loading notes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Notes Transfer
            </h1>
            
            {ip && port && pin ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <p className="text-green-800 text-sm font-medium">
                  🎯 Connection from QR Code
                </p>
                <p className="text-green-700 text-xs">
                  Desktop: {ip}:{port} | PIN: {pin}
                </p>
              </div>
            ) : (
              <p className="text-gray-600">
                Transfer your notes to desktop
              </p>
            )}
          </div>

          <QRP2PTransfer 
            notes={notes} 
            onTransferComplete={() => {
              console.log('Transfer completed from connect page')
            }}
            onNotesDeleted={handleNotesDeleted}
          />
          
          <div className="mt-6 text-center">
            <a 
              href="/" 
              className="text-blue-500 hover:text-blue-700 text-sm"
            >
              ← Back to Notes
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}