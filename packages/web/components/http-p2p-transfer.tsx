'use client'

import React, { useState, useRef } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Smartphone, Laptop, Loader2, Send, Wifi, CheckCircle, AlertCircle } from 'lucide-react'
import { HTTPWebRTCManager, type HTTPWebRTCManagerEvents } from '../lib/http-webrtc-manager'
import { deleteAllNotes } from '../lib/notes-storage'

interface Note {
  id: string
  content: string
  createdAt: string
  location?: {
    lat: number
    lng: number
  }
}

interface HTTPTransferProps {
  notes: Note[]
  onTransferComplete?: () => void
  onNotesDeleted?: () => void
}

export function HTTPP2PTransfer({ notes, onTransferComplete, onNotesDeleted }: HTTPTransferProps) {
  const [connectionState, setConnectionState] = useState<'idle' | 'discovering' | 'connecting' | 'connected' | 'transferring' | 'complete' | 'error'>('idle')
  const [pin, setPin] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [transferProgress, setTransferProgress] = useState({ sent: 0, total: 0 })
  const [desktopAddress, setDesktopAddress] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const webrtcManager = useRef<HTTPWebRTCManager | null>(null)

  const initializeWebRTC = () => {
    const events: HTTPWebRTCManagerEvents = {
      onConnectionStateChange: (state) => {
        console.log('📱 MOBILE: Connection state changed:', state)
        if (state === 'connected') {
          setConnectionState('connected')
          setErrorMessage('')
        } else if (state === 'failed' || state === 'disconnected') {
          if (connectionState !== 'complete') {
            setConnectionState('error')
            setErrorMessage('Connection failed or was lost')
          }
        }
      },
      onDataChannelOpen: () => {
        console.log('📱 MOBILE: Data channel opened')
        setConnectionState('connected')
        setStatusMessage('Ready to send notes')
      },
      onDataChannelClose: () => {
        console.log('📱 MOBILE: Data channel closed')
      },
      onTransferProgress: (progress) => {
        setTransferProgress(progress)
      },
      onTransferComplete: () => {
        setConnectionState('complete')
        setStatusMessage(`Successfully sent ${notes.length} notes`)
        onTransferComplete?.()
      },
      onError: (error) => {
        console.error('📱 MOBILE: WebRTC error:', error)
        setConnectionState('error')
        setErrorMessage(error.message || 'Connection error occurred')
      },
      onDesktopDiscovered: (address) => {
        console.log('📱 MOBILE: Desktop discovered at:', address)
        setDesktopAddress(address)
        setStatusMessage(`Found desktop at ${address}`)
      },
      onOfferSent: () => {
        setStatusMessage('Waiting for desktop to accept connection...')
      },
      onConnected: () => {
        setStatusMessage('Connected to desktop!')
      }
    }

    webrtcManager.current = new HTTPWebRTCManager(events)
  }

  const startConnection = async () => {
    if (!pin.trim()) {
      setErrorMessage('Please enter a PIN')
      return
    }

    try {
      setConnectionState('discovering')
      setErrorMessage('')
      setStatusMessage('Looking for desktop app on network...')
      
      console.log('📱 MOBILE: Starting connection with PIN:', pin)
      
      if (!webrtcManager.current) {
        initializeWebRTC()
      }
      
      if (webrtcManager.current) {
        setConnectionState('connecting')
        await webrtcManager.current.connectWithPIN(pin.trim())
      }
      
    } catch (error) {
      console.error('📱 MOBILE: Error starting connection:', error)
      setConnectionState('error')
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          setErrorMessage('Desktop app not found. Make sure it\'s running on the same WiFi network.')
        } else {
          setErrorMessage(error.message)
        }
      } else {
        setErrorMessage('Failed to connect to desktop')
      }
    }
  }

  const sendNotes = async () => {
    if (!webrtcManager.current) {
      setErrorMessage('No connection available')
      return
    }

    try {
      setConnectionState('transferring')
      setErrorMessage('')
      setStatusMessage(`Sending ${notes.length} notes...`)
      
      console.log(`📱 MOBILE: Sending ${notes.length} notes`)
      await webrtcManager.current.sendNotes(notes)
      
    } catch (error) {
      console.error('📱 MOBILE: Error sending notes:', error)
      setConnectionState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send notes')
    }
  }

  const reset = () => {
    if (webrtcManager.current) {
      webrtcManager.current.disconnect()
      webrtcManager.current = null
    }
    
    setConnectionState('idle')
    setPin('')
    setErrorMessage('')
    setTransferProgress({ sent: 0, total: 0 })
    setDesktopAddress('')
    setStatusMessage('')
  }

  const getStateIcon = () => {
    switch (connectionState) {
      case 'discovering':
      case 'connecting':
      case 'transferring':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'connected':
        return <Wifi className="h-4 w-4 text-green-500" />
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Smartphone className="h-4 w-4" />
    }
  }

  const getStateMessage = () => {
    if (statusMessage) return statusMessage
    
    switch (connectionState) {
      case 'discovering':
        return 'Scanning network for desktop app...'
      case 'connecting':
        return 'Establishing secure connection...'
      case 'connected':
        return 'Connected! Ready to send notes.'
      case 'transferring':
        return `Sending notes... ${Math.round((transferProgress.sent / transferProgress.total) * 100)}%`
      case 'complete':
        return `Transfer complete! Sent ${notes.length} notes.`
      case 'error':
        return errorMessage || 'Connection error'
      default:
        return 'Enter the PIN from your desktop app'
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Auto-Connect Transfer
        </CardTitle>
        <CardDescription>
          Send {notes.length} notes to your desktop app automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            {getStateIcon()}
            <span className="text-sm font-medium">
              {getStateMessage()}
            </span>
          </div>
          <Badge variant={connectionState === 'error' ? 'destructive' : connectionState === 'complete' ? 'default' : 'secondary'}>
            {connectionState}
          </Badge>
        </div>

        {/* Desktop Address Display */}
        {desktopAddress && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Desktop found:</strong> {desktopAddress}
            </p>
          </div>
        )}

        {/* PIN Input */}
        {connectionState === 'idle' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Desktop PIN</label>
              <Input
                placeholder="Enter 6-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase())}
                className="text-center font-mono mt-1"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Make sure your desktop app is running on the same WiFi network
              </p>
            </div>
            
            <Button onClick={startConnection} className="w-full" disabled={pin.length !== 6}>
              <Wifi className="h-4 w-4 mr-2" />
              Auto-Connect
            </Button>
          </div>
        )}

        {/* Send Notes */}
        {connectionState === 'connected' && (
          <Button onClick={sendNotes} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            Send {notes.length} Notes
          </Button>
        )}

        {/* Transfer Progress */}
        {connectionState === 'transferring' && (
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.round((transferProgress.sent / transferProgress.total) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {transferProgress.sent} / {transferProgress.total} bytes
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {(connectionState === 'error' || connectionState === 'complete') && (
          <Button onClick={reset} variant="outline" className="w-full">
            Start New Transfer
          </Button>
        )}

        {/* Error Message */}
        {errorMessage && connectionState === 'error' && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        {/* Help Text */}
        {connectionState === 'idle' && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>How it works:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Generate a PIN on your desktop app</li>
              <li>Enter the PIN here and tap Auto-Connect</li>
              <li>The app will find your desktop automatically</li>
              <li>Your notes will transfer securely via WiFi</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}