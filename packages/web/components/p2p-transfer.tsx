"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Send, CheckCircle, XCircle, Loader2, AlertTriangle, WifiOff, Copy, Shield } from "lucide-react"
import { getAllNotes, deleteAllNotes, type Note } from "@/lib/notes-storage"
import { WebRTCManager, type TransferData, type WebRTCManagerEvents } from "@/lib/webrtc-manager"

type TransferStatus = "idle" | "connecting" | "connected" | "transferring" | "completed" | "error"

interface ConnectionInfo {
  state: string
  iceState: string
  dataChannelState: string
  attempts: number
  isSafariMobile: boolean
}

export default function P2PTransfer() {
  const [status, setStatus] = useState<TransferStatus>("idle")
  const [pin, setPin] = useState("")
  const [desktopUrl, setDesktopUrl] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [deleteAfterTransfer, setDeleteAfterTransfer] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(null)
  const [transferStats, setTransferStats] = useState({ notesCount: 0, totalSize: "" })
  const [isOnline, setIsOnline] = useState(true) // Start with true to avoid hydration mismatch
  const [isMounted, setIsMounted] = useState(false)
  
  const webrtcManager = useRef<WebRTCManager | null>(null)

  // Monitor online status and mount state
  useEffect(() => {
    // Set initial state after mount to avoid hydration mismatch
    setIsMounted(true)
    setIsOnline(navigator.onLine)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Auto-detect localhost
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      const port = process.env.NODE_ENV === 'development' ? 8081 : 8080
      setDesktopUrl(`http://localhost:${port}`)
    }
  }, [])

  // Calculate data size
  const calculateDataSize = (notes: Note[]) => {
    const dataStr = JSON.stringify(notes)
    const bytes = new Blob([dataStr]).size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Get device name
  const getDeviceName = () => {
    const userAgent = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(userAgent)) return "iPhone"
    if (/Android/.test(userAgent)) return "Android"
    if (/Mac/.test(userAgent)) return "Mac"
    if (/Windows/.test(userAgent)) return "Windows"
    return "Mobile Device"
  }

  // Initialize WebRTC manager
  const initializeWebRTC = () => {
    const events: WebRTCManagerEvents = {
      onConnectionStateChange: (state) => {
        console.log('Connection state changed:', state)
        updateConnectionInfo()
        
        if (state === 'connected') {
          setStatus('connected')
        } else if (state === 'failed' || state === 'disconnected') {
          setStatus('error')
          setError('Connection lost. Please try again.')
        }
      },
      
      onDataChannelOpen: () => {
        console.log('Data channel opened - ready to transfer')
        setStatus('connected')
        updateConnectionInfo()
      },
      
      onDataChannelClose: () => {
        console.log('Data channel closed')
        if (status !== 'completed') {
          setStatus('error')
          setError('Connection closed unexpectedly')
        }
      },
      
      onDataReceived: (data: TransferData) => {
        // This is for receiving - not needed for sending only
        console.log('Data received:', data)
      },
      
      onTransferProgress: (progress) => {
        setProgress(progress)
        if (progress > 0 && progress < 100) {
          setStatus('transferring')
        }
      },
      
      onError: (error) => {
        console.error('WebRTC error:', error)
        setStatus('error')
        setError(error.message || 'Connection error occurred')
        updateConnectionInfo()
      },
      
      onSignalingError: (error) => {
        console.error('Signaling error:', error)
        if (error.message.includes('fetch')) {
          setError('Cannot reach desktop. Check IP address and ensure desktop app is running.')
        } else {
          setError(`Connection error: ${error.message}`)
        }
      }
    }

    // Configure with custom signaling URL if provided
    const config = {
      signalingUrl: desktopUrl ? `${desktopUrl}/signal` : undefined,
      polite: true,
      reconnectAttempts: 3,
      connectionTimeout: 30000
    }

    webrtcManager.current = new WebRTCManager(config, events)
    updateConnectionInfo()
  }

  // Update connection info
  const updateConnectionInfo = () => {
    if (webrtcManager.current) {
      const stats = webrtcManager.current.getConnectionStats()
      setConnectionInfo({
        state: stats.connectionState || 'new',
        iceState: stats.iceConnectionState || 'new',
        dataChannelState: stats.dataChannelState || 'closed',
        attempts: stats.connectionAttempts || 0,
        isSafariMobile: stats.isSafariMobile || false
      })
    }
  }

  // Connect to desktop/device
  const connect = async () => {
    if (!pin || pin.length !== 6) {
      setError('Please enter a valid 6-character PIN')
      return
    }

    if (!isOnline) {
      setError('No internet connection')
      return
    }

    try {
      setStatus('connecting')
      setError('')
      setProgress(0)
      
      // Calculate transfer stats
      const notes = getAllNotes()
      setTransferStats({
        notesCount: notes.length,
        totalSize: calculateDataSize(notes)
      })
      
      // Initialize WebRTC
      initializeWebRTC()
      
      // Connect using PIN
      await webrtcManager.current!.connectToDesktop(pin)
      
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to connect')
      updateConnectionInfo()
    }
  }

  // Send notes
  const sendNotes = async () => {
    if (!webrtcManager.current) {
      setError('WebRTC manager not initialized')
      return
    }

    try {
      setStatus('transferring')
      setProgress(0)
      
      const notes = getAllNotes()
      const transferData: TransferData = {
        type: 'notes-transfer',
        notes,
        totalSize: new Blob([JSON.stringify(notes)]).size,
        deviceName: getDeviceName(),
        timestamp: Date.now()
      }
      
      await webrtcManager.current.sendData(transferData)
      
      // Delete notes if requested
      if (deleteAfterTransfer) {
        try {
          await deleteAllNotes()
        } catch (deleteError) {
          console.error('Error deleting notes:', deleteError)
          setError('Transfer successful, but failed to delete notes from this device')
          return
        }
      }
      
      setStatus('completed')
      
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to send notes')
      updateConnectionInfo()
    }
  }

  // Reset connection
  const reset = async () => {
    if (webrtcManager.current) {
      await webrtcManager.current.cleanup()
      webrtcManager.current = null
    }
    
    setStatus("idle")
    setPin("")
    setProgress(0)
    setError("")
    setDeleteAfterTransfer(false)
    setConnectionInfo(null)
    setTransferStats({ notesCount: 0, totalSize: "" })
  }

  // Copy desktop URL
  const copyDesktopUrl = () => {
    navigator.clipboard.writeText(desktopUrl)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (webrtcManager.current) {
        webrtcManager.current.cleanup()
      }
    }
  }, [])

  // Main render
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="w-5 h-5" />
          Transfer Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Network status warning - only show after mount */}
        {isMounted && !isOnline && (
          <div className="bg-red-50 p-3 rounded flex items-center gap-2 text-red-700">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm">No internet connection</span>
          </div>
        )}

        {/* Idle state - PIN entry */}
        {status === "idle" && (
          <>
            <div className="text-center space-y-3">
              <Shield className="w-12 h-12 mx-auto text-blue-500" />
              <div>
                <h3 className="font-medium">Enter Transfer PIN</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Generate a PIN on the receiving device
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Enter 6-character PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase().slice(0, 6))}
                className="text-center text-lg font-mono"
                maxLength={6}
              />

              {/* Advanced settings */}
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full text-xs"
                >
                  {showAdvanced ? "Hide" : "Show"} advanced settings
                </Button>

                {showAdvanced && (
                  <div className="space-y-3 p-3 bg-gray-50 rounded">
                    <div>
                      <label className="text-xs font-medium">Desktop URL (optional)</label>
                      <div className="flex gap-1 mt-1">
                        <Input
                          type="text"
                          placeholder="http://192.168.1.100:8080"
                          value={desktopUrl}
                          onChange={(e) => setDesktopUrl(e.target.value)}
                          className="text-xs"
                        />
                        <Button size="sm" variant="outline" onClick={copyDesktopUrl}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Leave empty to use default. Set if desktop is on different network.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="delete-after"
                    checked={deleteAfterTransfer}
                    onCheckedChange={(checked) => setDeleteAfterTransfer(checked === true)}
                  />
                  <label 
                    htmlFor="delete-after" 
                    className="text-sm text-gray-600 cursor-pointer"
                  >
                    Delete notes from this device after transfer
                  </label>
                </div>
              </div>

              {transferStats.notesCount > 0 && (
                <div className="bg-blue-50 p-3 rounded text-sm">
                  <p><strong>Ready to transfer:</strong> {transferStats.notesCount} notes ({transferStats.totalSize})</p>
                </div>
              )}

              <Button 
                onClick={connect} 
                disabled={pin.length !== 6 || !isOnline}
                className="w-full"
              >
                Connect
              </Button>
            </div>
          </>
        )}

        {/* Connecting state */}
        {status === "connecting" && (
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
            <p className="text-sm text-gray-600">Establishing secure connection...</p>
            {connectionInfo && (
              <div className="space-y-2 text-xs">
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="secondary">{connectionInfo.state}</Badge>
                  <Badge variant="secondary">ICE: {connectionInfo.iceState}</Badge>
                </div>
                {connectionInfo.attempts > 1 && (
                  <p className="text-gray-500">Attempt {connectionInfo.attempts}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Connected state */}
        {status === "connected" && (
          <>
            <div className="text-center space-y-2">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
              <h3 className="font-medium text-green-700">Connected!</h3>
              <p className="text-sm text-gray-600">
                Ready to transfer {transferStats.notesCount} notes ({transferStats.totalSize})
              </p>
            </div>
            
            <Button onClick={sendNotes} className="w-full">
              Start Transfer
            </Button>
          </>
        )}

        {/* Transferring state */}
        {status === "transferring" && (
          <div className="space-y-3">
            <div className="text-center">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500 mb-2" />
              <p className="text-sm text-gray-600">Transferring notes...</p>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-xs text-center text-gray-500">{progress.toFixed(1)}% complete</p>
          </div>
        )}

        {/* Completed state */}
        {status === "completed" && (
          <>
            <div className="text-center space-y-2">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
              <h3 className="font-medium text-green-700">Transfer Complete!</h3>
            </div>

            <div className="bg-green-50 p-3 rounded space-y-1">
              <p className="text-sm">
                <strong>Transferred:</strong> {transferStats.notesCount} notes ({transferStats.totalSize})
              </p>
              {deleteAfterTransfer && (
                <p className="text-sm text-green-600">
                  <strong>✓ Notes deleted from this device</strong>
                </p>
              )}
            </div>
            
            <Button onClick={reset} className="w-full">
              Done
            </Button>
          </>
        )}

        {/* Error state */}
        {status === "error" && (
          <>
            <div className="text-center space-y-2">
              <XCircle className="w-12 h-12 mx-auto text-red-500" />
              <h3 className="font-medium text-red-700">Transfer Failed</h3>
            </div>
            
            {error && (
              <div className="bg-red-50 p-3 rounded">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            
            {connectionInfo && (
              <div className="text-xs text-gray-500 space-y-1">
                <p>Connection: {connectionInfo.state}</p>
                <p>ICE: {connectionInfo.iceState}</p>
                {connectionInfo.isSafariMobile && (
                  <p className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    Safari mobile detected
                  </p>
                )}
              </div>
            )}
            
            <div className="flex gap-2">
              <Button onClick={reset} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={connect} className="flex-1">
                Try Again
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}