import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Badge } from './ui/badge'
import { Loader2, Smartphone, Laptop, CheckCircle, XCircle, Wifi, WifiOff, Copy, Check } from 'lucide-react'
import { SimpleWebRTCManager, type WebRTCManagerConfig, type WebRTCManagerEvents } from '../lib/simple-webrtc-manager'

interface ConnectionInfo {
  state: string
  pin: string | null
  deviceType: 'mobile' | 'desktop'
  lastActivity: Date
}

export function P2PTransfer() {
  const [connectionState, setConnectionState] = useState<'idle' | 'pin-generated' | 'waiting-for-offer' | 'processing-offer' | 'answer-ready' | 'connected' | 'transferring' | 'complete' | 'error'>('idle')
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    state: 'disconnected',
    pin: null,
    deviceType: 'desktop',
    lastActivity: new Date()
  })
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [offer, setOffer] = useState('')
  const [answer, setAnswer] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [receivedNotes, setReceivedNotes] = useState<any[]>([])
  const [copied, setCopied] = useState(false)

  const webrtcManager = useRef<SimpleWebRTCManager | null>(null)

  useEffect(() => {
    setIsMounted(true)
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }
  }, [])

  const updateConnectionInfo = () => {
    if (webrtcManager.current) {
      const manager = webrtcManager.current
      setConnectionInfo(prev => ({
        ...prev,
        state: manager.getConnectionState() || 'disconnected',
        lastActivity: new Date()
      }))
    }
  }

  const initializeWebRTC = () => {
    const config: WebRTCManagerConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      deviceType: 'desktop'
    }

    const events: WebRTCManagerEvents = {
      onConnectionStateChange: (state) => {
        console.log('🖥️ DESKTOP: Connection state changed:', state)
        updateConnectionInfo()
        
        if (state === 'connected') {
          setConnectionState('connected')
          setErrorMessage('')
        } else if (state === 'failed' || state === 'disconnected') {
          setConnectionState('error')
          setErrorMessage('Connection failed or was lost')
        }
      },
      onDataReceived: async (data) => {
        console.log('🖥️ DESKTOP: Data received:', data)
        
        if (data.type === 'notes-transfer') {
          setConnectionState('transferring')
          console.log(`🖥️ DESKTOP: Received ${data.notes.length} notes`)
          
          try {
            // Save notes using standard Electron APIs
            const savedNotes = []
            for (const note of data.notes) {
              try {
                // Create a title from the note content (first 50 chars, cleaned up)
                const title = note.content
                  .trim()
                  .substring(0, 50)
                  .replace(/[\r\n]+/g, ' ')
                  .trim()

                // Prepare the content with location info if available
                let enrichedContent = note.content
                if (note.location && note.location.lat && note.location.lng) {
                  const { lat, lng } = note.location
                  const mapsUrl = `https://maps.google.com/maps?q=${lat},${lng}`
                  const locationInfo = `\n\n📍 **Location**: [${lat.toFixed(6)}, ${lng.toFixed(6)}](${mapsUrl})`
                  enrichedContent = note.content + locationInfo
                  console.log(`🖥️ DESKTOP: Adding location data: ${lat.toFixed(6)}, ${lng.toFixed(6)}`)
                }

                // Save as idea using the standard Electron API
                await window.electronAPI.ideas.create(enrichedContent, {
                  title: title || 'Transferred note',
                  created: note.createdAt || new Date().toISOString(),
                  processed: false
                })
                
                savedNotes.push(note)
                console.log(`🖥️ DESKTOP: Saved note: "${title}"`)
              } catch (error) {
                console.error(`🖥️ DESKTOP: Error saving note:`, error)
              }
            }
            
            setReceivedNotes(savedNotes)
            setConnectionState('complete')
            console.log(`🖥️ DESKTOP: Successfully saved ${savedNotes.length}/${data.notes.length} notes`)
            
            // WebRTC cleanup is now handled by the manager automatically
            
          } catch (error) {
            console.error('🖥️ DESKTOP: Error processing notes:', error)
            setConnectionState('error')
            setErrorMessage('Failed to save received notes')
          }
        }
      },
      onError: (error) => {
        console.error('🖥️ DESKTOP: WebRTC error:', error)
        setConnectionState('error')
        setErrorMessage(error.message || 'WebRTC connection error')
      },
      onAnswerReady: (answerString) => {
        console.log('🖥️ DESKTOP: Answer ready')
        setAnswer(answerString)
        setConnectionState('answer-ready')
      }
    }

    webrtcManager.current = new SimpleWebRTCManager(config, events)
  }

  const generatePIN = async () => {
    try {
      setConnectionState('pin-generated')
      setErrorMessage('')
      
      console.log('🖥️ DESKTOP: Generating PIN...')
      const pin = await window.electronAPI.transfer.generateTransferPin()
      
      console.log('🖥️ DESKTOP: PIN generated:', pin)
      setConnectionInfo(prev => ({ ...prev, pin }))
      setConnectionState('waiting-for-offer')
      
      // Initialize WebRTC for receiving
      initializeWebRTC()
      
    } catch (error) {
      console.error('🖥️ DESKTOP: Error generating PIN:', error)
      setConnectionState('error')
      setErrorMessage('Failed to generate PIN')
    }
  }

  const processOffer = async () => {
    if (!offer.trim()) {
      setErrorMessage('Please paste the offer from mobile')
      return
    }

    try {
      setConnectionState('processing-offer')
      setErrorMessage('')
      
      if (!webrtcManager.current) {
        initializeWebRTC()
      }
      
      if (webrtcManager.current) {
        console.log('🖥️ DESKTOP: Processing offer from mobile')
        await webrtcManager.current.handleOffer(offer.trim())
      }
      
    } catch (error) {
      console.error('🖥️ DESKTOP: Error processing offer:', error)
      setConnectionState('error')
      setErrorMessage(error.message || 'Failed to process offer')
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
    setConnectionInfo({
      state: 'disconnected',
      pin: null,
      deviceType: 'desktop',
      lastActivity: new Date()
    })
    setErrorMessage('')
    setOffer('')
    setAnswer('')
    setReceivedNotes([])
    setCopied(false)
    
    // Clear PIN
    window.electronAPI.transfer.clearTransferPin().catch(console.error)
  }

  const getStateIcon = () => {
    switch (connectionState) {
      case 'pin-generated':
      case 'processing-offer':
      case 'transferring':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'waiting-for-offer':
        return <Smartphone className="h-4 w-4" />
      case 'answer-ready':
        return <Copy className="h-4 w-4" />
      case 'connected':
      case 'complete':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Laptop className="h-4 w-4" />
    }
  }

  const getStateMessage = () => {
    switch (connectionState) {
      case 'pin-generated':
        return 'PIN generated successfully'
      case 'waiting-for-offer':
        return `PIN: ${connectionInfo.pin} - Ready for mobile connection`
      case 'processing-offer':
        return 'Processing offer from mobile...'
      case 'answer-ready':
        return 'Answer ready! Share with mobile device.'
      case 'connected':
        return 'Connected! Ready to receive notes.'
      case 'transferring':
        return 'Receiving notes...'
      case 'complete':
        return `Transfer complete! Received ${receivedNotes.length} notes.`
      case 'error':
        return errorMessage || 'Connection error'
      default:
        return 'Ready to receive notes from mobile'
    }
  }

  if (!isMounted) {
    return <div className="h-32 animate-pulse bg-muted rounded" />
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Laptop className="h-5 w-5" />
          Desktop Transfer
        </CardTitle>
        <CardDescription>
          Receive notes from mobile devices via P2P connection
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
          <div className="flex items-center gap-1">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            <Badge variant={connectionState === 'error' ? 'destructive' : connectionState === 'complete' ? 'default' : 'secondary'}>
              {connectionInfo.state}
            </Badge>
          </div>
        </div>

        {/* Action Buttons */}
        {connectionState === 'idle' && (
          <Button 
            onClick={generatePIN} 
            className="w-full"
            disabled={!isOnline}
          >
            Generate PIN to Receive Notes
          </Button>
        )}

        {/* Offer Input */}
        {connectionState === 'waiting-for-offer' && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Paste the offer from your mobile device:</p>
            <Textarea
              placeholder="Paste offer here..."
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              className="font-mono text-xs h-32"
            />
            <Button 
              onClick={processOffer} 
              className="w-full"
              disabled={!offer.trim()}
            >
              Process Offer
            </Button>
          </div>
        )}

        {/* Answer Display */}
        {connectionState === 'answer-ready' && answer && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Share this answer with your mobile device:</p>
            <div className="relative">
              <Textarea
                value={answer}
                readOnly
                className="font-mono text-xs h-32 resize-none"
              />
              <Button
                size="sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(answer)}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              After mobile enters this answer, the connection will be established
            </p>
          </div>
        )}

        {/* Control Buttons */}
        {(connectionState !== 'idle' && connectionState !== 'complete') && (
          <Button onClick={reset} variant="outline" className="w-full">
            Cancel
          </Button>
        )}

        {connectionState === 'complete' && (
          <div className="space-y-2">
            <Button onClick={reset} className="w-full">
              Start New Transfer
            </Button>
            {receivedNotes.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Notes saved to inbox for processing
              </p>
            )}
          </div>
        )}

        {/* Error Message */}
        {errorMessage && connectionState === 'error' && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        {/* PIN Display */}
        {connectionInfo.pin && (connectionState === 'waiting-for-offer' || connectionState === 'processing-offer') && (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-2">PIN for mobile device:</p>
            <p className="text-2xl font-mono font-bold text-primary">{connectionInfo.pin}</p>
            <p className="text-xs text-muted-foreground mt-2">PIN expires in 5 minutes</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}