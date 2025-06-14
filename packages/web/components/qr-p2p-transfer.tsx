'use client'

import React, { useState, useRef } from 'react'
import { QRScannerFullscreen } from './qr-scanner-fullscreen'
import { parseConnectionQR } from '../lib/qr-utils'
import { HTTPWebRTCManager, type HTTPWebRTCManagerEvents } from '../lib/http-webrtc-manager'
import { deleteAllNotes } from '../lib/notes-storage'

interface QRP2PTransferProps {
  notes: Array<{
    id: string
    content: string
    createdAt: string
    location?: {
      lat: number
      lng: number
    }
  }>
  onTransferComplete?: () => void
  onNotesDeleted?: () => void
}

export function QRP2PTransfer({ notes, onTransferComplete, onNotesDeleted }: QRP2PTransferProps) {
  const [transferState, setTransferState] = useState<'idle' | 'qr-scanning' | 'pin-entry' | 'connecting' | 'connected' | 'transferring' | 'complete' | 'error'>('idle')
  const [connectionProgress, setConnectionProgress] = useState('')
  const [transferProgress, setTransferProgress] = useState({ sent: 0, total: 0 })
  const [errorMessage, setErrorMessage] = useState('')
  const [pin, setPin] = useState('')
  const [manualIP, setManualIP] = useState('')
  const [connectionMethod, setConnectionMethod] = useState<'qr' | 'pin' | 'manual' | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [certificateErrorShown, setCertificateErrorShown] = useState(false)

  const webrtcManager = useRef<HTTPWebRTCManager | null>(null)

  const handleQRScan = async (qrData: string) => {
    console.log('📱 QR Transfer: QR code scanned:', qrData)
    
    const connectionData = parseConnectionQR(qrData)
    
    if (!connectionData) {
      setErrorMessage('Invalid QR code - not a valid connection code')
      setTransferState('error')
      return
    }

    console.log('📱 QR Transfer: Valid connection data found:', connectionData)
    
    try {
      setTransferState('connecting')
      setCertificateErrorShown(false) // Reset certificate error flag
      setConnectionProgress(`Connecting to ${connectionData.ip}:${connectionData.port}...`)
      
      await connectWithData(connectionData)
      
    } catch (error) {
      console.error('📱 QR Transfer: QR connection failed:', error)
      // Don't overwrite certificate error messages
      if (!certificateErrorShown) {
        setErrorMessage(error instanceof Error ? error.message : 'QR connection failed')
        setTransferState('error')
      }
    }
  }

  const handlePinConnect = async () => {
    if (!pin.trim()) {
      setErrorMessage('Please enter a PIN')
      return
    }

    try {
      setTransferState('connecting')
      setCertificateErrorShown(false) // Reset certificate error flag
      setConnectionProgress('Discovering desktop on network...')
      
      // Use existing PIN-based connection (with network discovery)
      await connectWithPIN(pin.trim())
      
    } catch (error) {
      console.error('📱 QR Transfer: PIN connection failed:', error)
      // Don't overwrite certificate error messages
      if (!certificateErrorShown) {
        setErrorMessage(error instanceof Error ? error.message : 'PIN connection failed')
        setTransferState('error')
      }
    }
  }

  const handleManualConnect = async () => {
    if (!manualIP.trim() || !pin.trim()) {
      setErrorMessage('Please enter both IP address and PIN')
      return
    }

    try {
      setTransferState('connecting')
      setCertificateErrorShown(false) // Reset certificate error flag
      setConnectionProgress(`Connecting to ${manualIP}...`)
      
      // Connect directly using IP and PIN (bypass network discovery)
      const connectionData = { 
        ip: manualIP.trim(), 
        port: 8080, 
        pin: pin.trim() 
      }
      await connectWithData(connectionData)
      
    } catch (error) {
      console.error('📱 QR Transfer: Manual connection failed:', error)
      // Don't overwrite certificate error messages
      if (!certificateErrorShown) {
        setErrorMessage(error instanceof Error ? error.message : 'Manual connection failed')
        setTransferState('error')
      }
    }
  }

  const connectWithData = async (connectionData: { ip: string, port: number, pin: string }) => {
    const events: HTTPWebRTCManagerEvents = {
      onConnectionStateChange: (state) => {
        console.log('📱 QR Transfer: Connection state:', state)
        if (state === 'connected') {
          setTransferState('connected')
          setConnectionProgress('Connected! Starting transfer...')
        }
      },
      onDataChannelOpen: () => {
        console.log('📱 QR Transfer: Data channel opened')
        startTransfer()
      },
      onDataChannelClose: () => {
        console.log('📱 QR Transfer: Data channel closed')
      },
      onTransferProgress: (progress) => {
        setTransferProgress(progress)
      },
      onTransferComplete: () => {
        setTransferState('complete')
        onTransferComplete?.()
      },
      onError: (error) => {
        setErrorMessage(error.message)
        setTransferState('error')
      },
      onDesktopDiscovered: (address) => {
        setConnectionProgress(`Desktop found at ${address}`)
      },
      onOfferSent: () => {
        setConnectionProgress('Offer sent, waiting for response...')
      },
      onConnected: () => {
        setConnectionProgress('WebRTC connection established!')
      },
      onCertificateError: (httpsUrl) => {
        console.log('📱 QR Transfer: Certificate error for:', httpsUrl)
        setCertificateErrorShown(true)
        setErrorMessage(`HTTPS connection failed due to self-signed certificate. Please visit ${httpsUrl} in a new tab, accept the certificate warning, then try again.`)
        setTransferState('error')
      }
    }

    webrtcManager.current = new HTTPWebRTCManager(events)
    await webrtcManager.current.connectWithQRCode(connectionData)
  }

  const connectWithPIN = async (pinValue: string) => {
    const events: HTTPWebRTCManagerEvents = {
      onConnectionStateChange: (state) => {
        console.log('📱 QR Transfer: Connection state:', state)
        if (state === 'connected') {
          setTransferState('connected')
          setConnectionProgress('Connected! Starting transfer...')
        }
      },
      onDataChannelOpen: () => {
        console.log('📱 QR Transfer: Data channel opened')
        startTransfer()
      },
      onDataChannelClose: () => {
        console.log('📱 QR Transfer: Data channel closed')
      },
      onTransferProgress: (progress) => {
        setTransferProgress(progress)
      },
      onTransferComplete: () => {
        setTransferState('complete')
        onTransferComplete?.()
      },
      onError: (error) => {
        setErrorMessage(error.message)
        setTransferState('error')
      },
      onDesktopDiscovered: (address) => {
        setConnectionProgress(`Desktop found at ${address}`)
      },
      onOfferSent: () => {
        setConnectionProgress('Offer sent, waiting for response...')
      },
      onConnected: () => {
        setConnectionProgress('WebRTC connection established!')
      },
      onCertificateError: (httpsUrl) => {
        console.log('📱 QR Transfer: Certificate error for:', httpsUrl)
        setCertificateErrorShown(true)
        setErrorMessage(`HTTPS connection failed due to self-signed certificate. Please visit ${httpsUrl} in a new tab, accept the certificate warning, then try again.`)
        setTransferState('error')
      }
    }

    webrtcManager.current = new HTTPWebRTCManager(events)
    await webrtcManager.current.connectWithPIN(pinValue)
  }

  const startTransfer = async () => {
    if (!webrtcManager.current) return

    try {
      setTransferState('transferring')
      await webrtcManager.current.sendNotes(notes)
    } catch (error) {
      console.error('📱 QR Transfer: Transfer failed:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Transfer failed')
      setTransferState('error')
    }
  }

  const reset = () => {
    if (webrtcManager.current) {
      webrtcManager.current.disconnect()
      webrtcManager.current = null
    }
    
    setTransferState('idle')
    setConnectionProgress('')
    setTransferProgress({ sent: 0, total: 0 })
    setErrorMessage('')
    setPin('')
    setManualIP('')
    setConnectionMethod(null)
    setShowDeleteConfirm(false)
  }

  const handleDeleteNotes = () => {
    try {
      deleteAllNotes()
      onNotesDeleted?.()
      setShowDeleteConfirm(false)
      console.log('📱 QR Transfer: All notes deleted successfully')
    } catch (error) {
      console.error('📱 QR Transfer: Failed to delete notes:', error)
    }
  }

  const getProgressText = () => {
    if (transferProgress.total > 0) {
      const percent = Math.round((transferProgress.sent / transferProgress.total) * 100)
      return `Transferring... ${percent}% (${transferProgress.sent}/${transferProgress.total} bytes)`
    }
    return connectionProgress
  }

  return (
    <div className="w-full max-w-md mx-auto p-4 space-y-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Transfer {notes.length} Notes</h2>
        
        {transferState === 'idle' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Choose connection method:</p>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setConnectionMethod('qr')
                  setTransferState('qr-scanning')
                }}
                className="p-3 border border-green-300 rounded-lg hover:bg-green-50 text-center"
              >
                <div className="text-2xl mb-1">📱</div>
                <div className="text-sm font-medium">Scan QR</div>
                <div className="text-xs text-gray-500">Instant</div>
              </button>
              
              <button
                onClick={() => {
                  setConnectionMethod('pin')
                  setTransferState('pin-entry')
                }}
                className="p-3 border border-blue-300 rounded-lg hover:bg-blue-50 text-center"
              >
                <div className="text-2xl mb-1">🔢</div>
                <div className="text-sm font-medium">PIN Only</div>
                <div className="text-xs text-gray-500">Auto-find</div>
              </button>
              
              <button
                onClick={() => {
                  setConnectionMethod('manual')
                  setTransferState('pin-entry')
                }}
                className="p-3 border border-orange-300 rounded-lg hover:bg-orange-50 text-center"
              >
                <div className="text-2xl mb-1">⌨️</div>
                <div className="text-sm font-medium">Manual IP</div>
                <div className="text-xs text-gray-500">Direct</div>
              </button>
            </div>
          </div>
        )}

        {transferState === 'qr-scanning' && (
          <div className="space-y-4">
            <QRScannerFullscreen
              onScan={handleQRScan}
              onError={(error) => {
                console.log('📱 QR Scanner error:', error)
                // Don't auto-transition to error state, let user choose manual entry
                setErrorMessage(`Camera error: ${error}`)
              }}
              onClose={reset}
            />
            
            {/* Fallback option if camera fails */}
            {errorMessage && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800 mb-3">{errorMessage}</p>
                <button
                  onClick={() => {
                    setConnectionMethod('manual')
                    setTransferState('pin-entry')
                    setErrorMessage('')
                  }}
                  className="w-full bg-yellow-600 text-white py-2 rounded hover:bg-yellow-700"
                >
                  Enter PIN Manually Instead
                </button>
              </div>
            )}
          </div>
        )}

        {transferState === 'pin-entry' && (
          <div className="space-y-4">
            {connectionMethod === 'manual' && (
              <div>
                <label className="block text-sm font-medium mb-2">Desktop IP Address</label>
                <input
                  type="text"
                  value={manualIP}
                  onChange={(e) => setManualIP(e.target.value)}
                  placeholder="e.g., 192.168.1.100"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Copy IP address from desktop app
                </p>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium mb-2">Desktop PIN</label>
              <input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter 6-digit PIN"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={6}
              />
            </div>
            
            <div className="space-y-2">
              <button
                onClick={connectionMethod === 'manual' ? handleManualConnect : handlePinConnect}
                disabled={connectionMethod === 'manual' ? (!pin.trim() || !manualIP.trim()) : !pin.trim()}
                className={`w-full text-white py-2 rounded disabled:bg-gray-300 ${
                  connectionMethod === 'manual' 
                    ? 'bg-orange-500 hover:bg-orange-600' 
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {connectionMethod === 'manual' ? 'Connect Directly' : 'Connect with PIN'}
              </button>
              
              <button
                onClick={reset}
                className="w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
              >
                Back
              </button>
            </div>
            
            {connectionMethod === 'pin' && (
              <p className="text-xs text-gray-500 text-center">
                App will automatically find your desktop on the network
              </p>
            )}
            
            {connectionMethod === 'manual' && (
              <p className="text-xs text-gray-500 text-center">
                Direct connection bypasses network discovery
              </p>
            )}
          </div>
        )}

        {(transferState === 'connecting' || transferState === 'connected' || transferState === 'transferring') && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
              <p className="text-sm">{getProgressText()}</p>
            </div>
            
            {transferProgress.total > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((transferProgress.sent / transferProgress.total) * 100)}%` }}
                ></div>
              </div>
            )}
          </div>
        )}

        {transferState === 'complete' && !showDeleteConfirm && (
          <div className="text-center space-y-4">
            <div className="text-4xl">✅</div>
            <p className="text-green-600 font-medium">Transfer completed successfully!</p>
            <p className="text-sm text-gray-600">{notes.length} notes sent to desktop</p>
            
            <div className="space-y-2">
              <button
                onClick={reset}
                className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600"
              >
                Transfer More Notes
              </button>
              
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
              >
                Delete All Notes from This Device
              </button>
            </div>
          </div>
        )}

        {transferState === 'complete' && showDeleteConfirm && (
          <div className="text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <p className="text-red-600 font-medium">Delete all notes?</p>
            <p className="text-sm text-gray-600">This will permanently delete all {notes.length} notes from this device. They will remain on your desktop.</p>
            
            <div className="space-y-2">
              <button
                onClick={handleDeleteNotes}
                className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
              >
                Yes, Delete All Notes
              </button>
              
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="w-full bg-gray-500 text-white py-2 rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {transferState === 'error' && (
          <div className="text-center space-y-4">
            <div className="text-4xl">❌</div>
            <p className="text-red-600 font-medium">Transfer failed</p>
            <p className="text-sm text-red-500">{errorMessage}</p>
            
            <button
              onClick={reset}
              className="w-full bg-red-500 text-white py-2 rounded hover:bg-red-600"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}