import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Loader2, Laptop, CheckCircle, XCircle, Wifi, WifiOff, Smartphone, QrCode } from 'lucide-react'
import { SimpleWebRTCManager, type WebRTCManagerConfig, type WebRTCManagerEvents } from '../lib/simple-webrtc-manager'
import { generateConnectionQRDataURL } from '../lib/qr-generator'

interface ConnectionInfo {
  state: string
  pin: string | null
  deviceType: 'mobile' | 'desktop'
  lastActivity: Date
}

export function HTTPP2PTransfer() {
  const [connectionState, setConnectionState] = useState<'idle' | 'pin-generated' | 'waiting-for-offer' | 'processing-offer' | 'connected' | 'transferring' | 'complete' | 'error'>('idle')
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    state: 'disconnected',
    pin: null,
    deviceType: 'desktop',
    lastActivity: new Date()
  })
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isOnline, setIsOnline] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [receivedNotes, setReceivedNotes] = useState<any[]>([])
  const [httpServerStatus, setHttpServerStatus] = useState<string>('unknown')
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string | null>(null)
  const [showQRCode, setShowQRCode] = useState<boolean>(false)
  const [connectionIP, setConnectionIP] = useState<string>('')
  const pollingInterval = useRef<NodeJS.Timeout | null>(null)
  const currentPinRef = useRef<string | null>(null)
  const listenerSetup = useRef<boolean>(false)
  const pinGeneratedListenerSetup = useRef<boolean>(false)
  const processingOffer = useRef<boolean>(false)

  const webrtcManager = useRef<SimpleWebRTCManager | null>(null)

  useEffect(() => {
    setIsMounted(true)
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
      window.addEventListener('offline', handleOffline)

      // Listen for offers received via HTTP signaling
      const handleOfferReceived = (data: { pin: string, offer: string }) => {
        console.log('🖥️ DESKTOP: Received offer via IPC for PIN:', data.pin)
        console.log('🖥️ DESKTOP: Current PIN ref:', currentPinRef.current)
        if (data.pin === currentPinRef.current) {
          console.log('🖥️ DESKTOP: PIN matches, processing offer...')
          processOffer(data.offer)
        } else {
          console.log('🖥️ DESKTOP: PIN mismatch, ignoring offer')
        }
      }

      // CRITICAL: Set up IPC listener for offers FIRST before any PIN generation
      if (!listenerSetup.current) {
        console.log('🖥️ DESKTOP: Setting up IPC listener for webrtc-offer-received EARLY')
        window.electronAPI.transfer.onWebRTCOfferReceived(handleOfferReceived)
        listenerSetup.current = true
      }

      // Listen for HTTP signaling events (only once)
      if (!pinGeneratedListenerSetup.current) {
        console.log('🖥️ DESKTOP: Setting up onTransferPinGenerated listener...')
        pinGeneratedListenerSetup.current = true
        window.electronAPI.transfer.onTransferPinGenerated(async (data: { pin: string, ip: string, port: number }) => {
        const { pin, ip, port } = data
        
        console.log('🖥️ DESKTOP: *** PIN generated via IPC EVENT RECEIVED ***:', pin, 'IP:', ip)
        currentPinRef.current = pin
        setConnectionInfo(prev => ({ ...prev, pin }))
        setConnectionIP(ip)
        setConnectionState('waiting-for-offer')
        
        // Generate QR code with connection information
        try {
          console.log('🖥️ DESKTOP: Starting QR code generation...')
          console.log('🖥️ DESKTOP: Using IP from main process:', ip)
          console.log('🖥️ DESKTOP: QR code data:', { ip, port, pin, version: '1.0' })
          
          const qrDataURL = await generateConnectionQRDataURL({
            ip,
            port,
            pin,
            version: '1.0'
          })
          
          console.log('🖥️ DESKTOP: QR data URL generated, length:', qrDataURL?.length || 'null')
          setQrCodeDataURL(qrDataURL)
          setShowQRCode(true)
          console.log('🖥️ DESKTOP: QR code state updated successfully')
        } catch (error) {
          console.error('🖥️ DESKTOP: Failed to generate QR code:', error)
          console.error('🖥️ DESKTOP: Error details:', error instanceof Error ? error.message : 'Unknown error', error instanceof Error ? error.stack : '')
          // Continue without QR code - PIN still works
        }
      })
      }

      // Set initial HTTP server status and start polling once we have a PIN
      setHttpServerStatus('Ready')

      return () => {
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
        stopOfferPolling()
        
        // Only remove IPC listener on actual component unmount
        // Don't remove on re-renders
      }
    }
  }, [])

  const startOfferPolling = (pin: string) => {
    console.log('🖥️ DESKTOP: Starting offer polling for PIN:', pin)
    pollingInterval.current = setInterval(async () => {
      try {
        const offer = await window.electronAPI.transfer.getPendingOffer(pin)
        if (offer) {
          console.log('🖥️ DESKTOP: Found pending offer, processing...')
          console.log('🖥️ DESKTOP: Offer string length:', offer.length)
          stopOfferPolling()
          await processOffer(offer)
        }
      } catch (error) {
        console.error('🖥️ DESKTOP: Error polling for offer:', error)
      }
    }, 2000) // Poll every 2 seconds
  }

  const stopOfferPolling = () => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current)
      pollingInterval.current = null
    }
  }

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
          if (connectionState !== 'complete') {
            setConnectionState('error')
            setErrorMessage('Connection failed or was lost')
          }
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
      onAnswerReady: async (answerString) => {
        console.log('🖥️ DESKTOP: Answer ready, submitting via HTTP')
        
        // Submit answer via HTTP signaling
        if (currentPinRef.current) {
          try {
            const success = await window.electronAPI.transfer.submitWebRTCAnswer(currentPinRef.current, answerString)
            if (success) {
              console.log('🖥️ DESKTOP: Answer submitted successfully via HTTP')
            } else {
              console.error('🖥️ DESKTOP: Failed to submit answer via HTTP')
              setErrorMessage('Failed to send answer to mobile device')
            }
          } catch (error) {
            console.error('🖥️ DESKTOP: Error submitting answer:', error)
            setErrorMessage('Failed to communicate with mobile device')
          }
        } else {
          console.error('🖥️ DESKTOP: No PIN available for answer submission')
        }
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
      // PIN will be set via the onTransferPinGenerated event
      
      // Initialize WebRTC for receiving
      initializeWebRTC()
      
      // Start polling for offers with this PIN
      startOfferPolling(pin)
      
    } catch (error) {
      console.error('🖥️ DESKTOP: Error generating PIN:', error)
      setConnectionState('error')
      setErrorMessage('Failed to generate PIN')
    }
  }

  const processOffer = async (offerString: string) => {
    console.log('🖥️ DESKTOP: processOffer called with offer length:', offerString?.length)
    
    // Prevent duplicate offer processing
    if (processingOffer.current) {
      console.log('🖥️ DESKTOP: Already processing an offer, ignoring duplicate')
      return
    }
    
    processingOffer.current = true
    
    try {
      setConnectionState('processing-offer')
      setErrorMessage('')
      
      if (!webrtcManager.current) {
        console.log('🖥️ DESKTOP: Initializing WebRTC manager...')
        initializeWebRTC()
      }
      
      if (webrtcManager.current) {
        console.log('🖥️ DESKTOP: Processing offer from mobile via HTTP')
        await webrtcManager.current.handleOffer(offerString)
        console.log('🖥️ DESKTOP: Offer processed successfully')
      } else {
        console.error('🖥️ DESKTOP: WebRTC manager not available')
      }
      
    } catch (error) {
      console.error('🖥️ DESKTOP: Error processing offer:', error)
      setConnectionState('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process offer')
    } finally {
      // Reset the processing flag regardless of success or failure
      processingOffer.current = false
    }
  }

  const reset = () => {
    // Stop polling
    stopOfferPolling()
    
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
    setReceivedNotes([])
    
    // Reset processing flags
    processingOffer.current = false
    
    // Clear QR code
    setQrCodeDataURL(null)
    setShowQRCode(false)
    setConnectionIP('')
    
    // Clear PIN ref
    currentPinRef.current = null
    
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
        return `PIN: ${connectionInfo.pin} - Waiting for mobile connection`
      case 'processing-offer':
        return 'Processing connection from mobile...'
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
    <div className="h-full flex flex-col overflow-y-auto">
      <Card className="flex-1 flex flex-col w-full max-w-md mx-auto">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2 ">
            <Laptop className="h-5 w-5" />
            Auto-Connect Transfer
          </CardTitle>
          <CardDescription>
            Receive notes from mobile devices automatically via WiFi
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
        {/* HTTP Server Status */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>HTTP Server:</strong> {httpServerStatus}
          </p>
        </div>

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

        {/* QR Code Display */}
        {showQRCode && qrCodeDataURL && (connectionState === 'waiting-for-offer' || connectionState === 'processing-offer') && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <QrCode className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-800">Instant Connection QR Code</p>
            </div>
            
            <div className="bg-white p-3 rounded-lg border border-green-200 mb-3 inline-block">
              <img 
                src={qrCodeDataURL} 
                alt="Connection QR Code" 
                className="w-32 h-32 mx-auto"
              />
            </div>
            
            <p className="text-xs text-green-700 mb-2">
              Scan with mobile camera or QR app for instant connection
            </p>
            
            {/* Direct URL for testing */}
            <div className="bg-white p-2 rounded border border-green-200 mb-2">
              <p className="text-xs text-gray-600 mb-1">Or copy this URL for testing:</p>
              <input 
                type="text"
                value={`http://localhost:3001/connect?ip=${connectionIP}&port=8080&pin=${connectionInfo.pin}&v=1.0`}
                readOnly
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 font-mono"
                onClick={(e) => {
                  e.currentTarget.select()
                  navigator.clipboard.writeText(e.currentTarget.value)
                  console.log('URL copied to clipboard')
                }}
              />
              <p className="text-xs text-gray-500 mt-1">Click to select and copy</p>
            </div>
            
            <p className="text-xs text-green-600">
              No network scanning required!
            </p>
          </div>
        )}


        {/* PIN Display */}
        {connectionInfo.pin && (connectionState === 'waiting-for-offer' || connectionState === 'processing-offer') && (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-2">PIN for mobile device:</p>
            <p className="text-2xl font-mono font-bold text-primary">{connectionInfo.pin}</p>
            <p className="text-xs text-muted-foreground mt-2">PIN expires in 5 minutes</p>
            <p className="text-xs text-muted-foreground mt-1">Mobile will auto-connect when PIN is entered</p>
          </div>
        )}

        {/* Manual IP Address Option */}
        {connectionInfo.pin && (connectionState === 'waiting-for-offer' || connectionState === 'processing-offer') && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Laptop className="h-4 w-4 text-orange-600" />
              <p className="text-sm font-medium text-orange-800">Manual Connection</p>
            </div>
            
            <p className="text-xs text-orange-700 mb-3">
              Alternative: Enter this info manually on mobile
            </p>
            
            <div className="space-y-2">
              <div className="bg-white p-2 rounded border border-orange-200">
                <p className="text-xs text-gray-600 mb-1">Desktop IP Address:</p>
                <input 
                  type="text"
                  value={connectionIP}
                  readOnly
                  className="w-full text-sm bg-gray-50 border border-gray-200 rounded px-2 py-1 font-mono text-center font-semibold"
                  onClick={(e) => {
                    e.currentTarget.select()
                    navigator.clipboard.writeText(connectionIP)
                    console.log('IP address copied to clipboard')
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">Click to copy IP address</p>
              </div>
              
              <div className="bg-white p-2 rounded border border-orange-200">
                <p className="text-xs text-gray-600 mb-1">Port: 8080 | PIN:</p>
                <input 
                  type="text"
                  value={connectionInfo.pin}
                  readOnly
                  className="w-full text-lg bg-gray-50 border border-gray-200 rounded px-2 py-1 font-mono text-center font-bold text-primary"
                  onClick={(e) => {
                    e.currentTarget.select()
                    navigator.clipboard.writeText(e.currentTarget.value)
                    console.log('PIN copied to clipboard')
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">Click to copy PIN</p>
              </div>
            </div>
          </div>
        )}

        {/* How it works */}
        {connectionState === 'idle' && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>How it works:</strong></p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Generate a PIN on this desktop</li>
              <li><strong>Option A:</strong> Scan QR code for instant connection</li>
              <li><strong>Option B:</strong> Enter PIN manually (auto-discovery)</li>
              <li>Notes transfer securely via WiFi</li>
            </ol>
          </div>
        )}
        </CardContent>
      </Card>
    </div>
  )
}