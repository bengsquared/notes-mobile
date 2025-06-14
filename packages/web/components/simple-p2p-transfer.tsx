'use client'

import React, { useState, useRef } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Textarea } from './ui/textarea'
import { Copy, Check, Smartphone, Laptop, Loader2, Send } from 'lucide-react'
import { SimpleWebRTCManager, type WebRTCManagerEvents } from '../lib/webrtc-manager-simple'

interface Note {
  id: string
  content: string
  createdAt: string
  location?: {
    lat: number
    lng: number
  }
}

interface SimpleP2PTransferProps {
  notes: Note[]
  onTransferComplete?: () => void
}

export function SimpleP2PTransfer({ notes, onTransferComplete }: SimpleP2PTransferProps) {
  const [connectionState, setConnectionState] = useState<'idle' | 'generating-offer' | 'waiting-for-answer' | 'connected' | 'transferring' | 'complete' | 'error'>('idle')
  const [pin, setPin] = useState('')
  const [offer, setOffer] = useState('')
  const [answer, setAnswer] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [transferProgress, setTransferProgress] = useState({ sent: 0, total: 0 })
  const [copied, setCopied] = useState(false)

  const webrtcManager = useRef<SimpleWebRTCManager | null>(null)

  const initializeWebRTC = () => {
    const events: WebRTCManagerEvents = {
      onConnectionStateChange: (state) => {
        console.log('📱 MOBILE: Connection state changed:', state)
        if (state === 'connected') {
          setConnectionState('connected')
          setErrorMessage('')
        } else if (state === 'failed' || state === 'disconnected') {
          setConnectionState('error')
          setErrorMessage('Connection failed or was lost')
        }
      },
      onDataChannelOpen: () => {
        console.log('📱 MOBILE: Data channel opened')
        setConnectionState('connected')
      },
      onDataChannelClose: () => {
        console.log('📱 MOBILE: Data channel closed')
      },
      onTransferProgress: (progress) => {
        setTransferProgress(progress)
      },
      onTransferComplete: () => {
        setConnectionState('complete')
        onTransferComplete?.()
      },
      onError: (error) => {
        console.error('📱 MOBILE: WebRTC error:', error)
        setConnectionState('error')
        setErrorMessage(error.message || 'WebRTC connection error')
      },
      onOfferReady: (offerString) => {
        console.log('📱 MOBILE: Offer ready')
        setOffer(offerString)
        setConnectionState('waiting-for-answer')
      },
      onAnswerNeeded: () => {
        // Not used in this simple implementation
      }
    }

    webrtcManager.current = new SimpleWebRTCManager({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }, events)
  }

  const startConnection = async () => {
    if (!pin.trim()) {
      setErrorMessage('Please enter a PIN')
      return
    }

    try {
      setConnectionState('generating-offer')
      setErrorMessage('')
      
      console.log('📱 MOBILE: Starting connection with PIN:', pin)
      
      if (!webrtcManager.current) {
        initializeWebRTC()
      }
      
      if (webrtcManager.current) {
        await webrtcManager.current.initializeConnection()
      }
      
    } catch (error) {
      console.error('📱 MOBILE: Error starting connection:', error)
      setConnectionState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start connection')
    }
  }

  const submitAnswer = async () => {
    if (!answer.trim()) {
      setErrorMessage('Please enter the answer from desktop')
      return
    }

    try {
      setErrorMessage('')
      
      if (webrtcManager.current) {
        await webrtcManager.current.handleAnswer(answer.trim())
        console.log('📱 MOBILE: Answer submitted, waiting for connection...')
      }
      
    } catch (error) {
      console.error('📱 MOBILE: Error submitting answer:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process answer')
    }
  }

  const sendNotes = async () => {
    if (!webrtcManager.current) {
      setErrorMessage('No WebRTC connection available')
      return
    }

    try {
      setConnectionState('transferring')
      setErrorMessage('')
      
      console.log(`📱 MOBILE: Sending ${notes.length} notes`)
      await webrtcManager.current.sendNotes(notes)
      
    } catch (error) {
      console.error('📱 MOBILE: Error sending notes:', error)
      setConnectionState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send notes')
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const reset = () => {
    if (webrtcManager.current) {
      webrtcManager.current.disconnect()
      webrtcManager.current = null
    }
    
    setConnectionState('idle')
    setPin('')
    setOffer('')
    setAnswer('')
    setErrorMessage('')
    setTransferProgress({ sent: 0, total: 0 })
    setCopied(false)
  }

  const getStateIcon = () => {
    switch (connectionState) {
      case 'generating-offer':
      case 'transferring':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'waiting-for-answer':
        return <Laptop className="h-4 w-4" />
      case 'connected':
      case 'complete':
        return <Check className="h-4 w-4 text-green-500" />
      case 'error':
        return <span className="h-4 w-4 text-red-500">✕</span>
      default:
        return <Smartphone className="h-4 w-4" />
    }
  }

  const getStateMessage = () => {
    switch (connectionState) {
      case 'generating-offer':
        return 'Generating connection offer...'
      case 'waiting-for-answer':
        return 'Share the offer with desktop and enter the answer below'
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
          Send to Desktop
        </CardTitle>
        <CardDescription>
          Send {notes.length} notes to your desktop app via P2P connection
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

        {/* PIN Input */}
        {connectionState === 'idle' && (
          <div className="space-y-2">
            <Input
              placeholder="Enter desktop PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              className="text-center font-mono"
              maxLength={6}
            />
            <Button onClick={startConnection} className="w-full">
              Start Connection
            </Button>
          </div>
        )}

        {/* Offer Display */}
        {connectionState === 'waiting-for-answer' && offer && (
          <div className="space-y-3">
            <div className="space-y-2">
              <p className="text-sm font-medium">1. Share this offer with your desktop:</p>
              <div className="relative">
                <Textarea
                  value={offer}
                  readOnly
                  className="font-mono text-xs h-32 resize-none"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(offer)}
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">2. Enter the answer from desktop:</p>
              <Textarea
                placeholder="Paste answer from desktop here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="font-mono text-xs h-24"
              />
              <Button onClick={submitAnswer} className="w-full" disabled={!answer.trim()}>
                Connect
              </Button>
            </div>
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
      </CardContent>
    </Card>
  )
}