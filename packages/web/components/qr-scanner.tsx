'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import jsQR from 'jsqr'

interface QRScannerProps {
  onScan: (data: string) => void
  onError?: (error: string) => void
  className?: string
}

interface QRCodeData {
  ip: string
  port: number
  pin: string
  v?: string
}

export function QRScanner({ onScan, onError, className = '' }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const scanningIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const stopScanning = useCallback(() => {
    setIsScanning(false)
    
    if (scanningIntervalRef.current) {
      clearInterval(scanningIntervalRef.current)
      scanningIntervalRef.current = null
    }
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
  }, [stream])

  const startScanning = useCallback(async () => {
    try {
      console.log('📱 QR Scanner: Requesting camera access...')
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      })

      setStream(mediaStream)
      setHasPermission(true)
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
        setIsScanning(true)
        
        console.log('📱 QR Scanner: Camera started, beginning scan loop')
        
        // Start scanning loop
        scanningIntervalRef.current = setInterval(() => {
          scanForQRCode()
        }, 300) // Scan every 300ms
      }
      
    } catch (error) {
      console.error('📱 QR Scanner: Camera access denied:', error)
      setHasPermission(false)
      const errorMessage = error instanceof Error ? error.message : 'Camera access denied'
      onError?.(`Camera access failed: ${errorMessage}`)
    }
  }, [onError])

  const scanForQRCode = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !isScanning) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Get image data for QR scanning
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Scan for QR code
    const code = jsQR(imageData.data, imageData.width, imageData.height)

    if (code) {
      console.log('📱 QR Scanner: QR code detected:', code.data)
      
      try {
        // Try to parse as connection URL
        const url = new URL(code.data)
        
        if (url.pathname === '/connect') {
          const ip = url.searchParams.get('ip')
          const port = url.searchParams.get('port')
          const pin = url.searchParams.get('pin')
          
          if (ip && port && pin) {
            console.log('📱 QR Scanner: Valid connection QR code found')
            stopScanning()
            onScan(code.data)
            return
          }
        }
        
        // If not a connection URL, still pass the raw data
        console.log('📱 QR Scanner: Non-connection QR code found, passing raw data')
        stopScanning()
        onScan(code.data)
        
      } catch (error) {
        // Not a valid URL, pass raw data
        console.log('📱 QR Scanner: Raw QR code data found')
        stopScanning()
        onScan(code.data)
      }
    }
  }, [isScanning, onScan, stopScanning])

  useEffect(() => {
    return () => {
      stopScanning()
    }
  }, [stopScanning])

  const handleStartScan = () => {
    startScanning()
  }

  const handleStopScan = () => {
    stopScanning()
  }

  return (
    <div className={`qr-scanner ${className}`}>
      {hasPermission === null && (
        <div className="text-center p-4">
          <button
            onClick={handleStartScan}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Start QR Scanner
          </button>
          <p className="text-sm text-gray-600 mt-2">
            Click to enable camera for QR code scanning
          </p>
        </div>
      )}

      {hasPermission === false && (
        <div className="text-center p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-700 text-sm">
            Camera access is required for QR code scanning.
          </p>
          <p className="text-red-600 text-xs mt-1">
            Please enable camera permissions and try again.
          </p>
          <button
            onClick={handleStartScan}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 mt-2 text-sm"
          >
            Retry Camera Access
          </button>
        </div>
      )}

      {hasPermission === true && (
        <div className="relative">
          <video
            ref={videoRef}
            className="w-full h-auto rounded-lg"
            playsInline
            muted
          />
          
          <canvas
            ref={canvasRef}
            className="hidden"
          />
          
          {isScanning && (
            <div className="absolute inset-0 border-2 border-blue-500 rounded-lg">
              <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
                Scanning for QR code...
              </div>
              
              {/* Scanner overlay */}
              <div className="absolute inset-4 border-2 border-white rounded-lg opacity-50">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-blue-400"></div>
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-blue-400"></div>
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-blue-400"></div>
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-blue-400"></div>
              </div>
            </div>
          )}
          
          <div className="mt-2 text-center">
            <button
              onClick={handleStopScan}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm"
            >
              Stop Scanner
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function parseConnectionQR(qrData: string): QRCodeData | null {
  try {
    const url = new URL(qrData)
    
    if (url.pathname === '/connect') {
      const ip = url.searchParams.get('ip')
      const port = url.searchParams.get('port')
      const pin = url.searchParams.get('pin')
      const version = url.searchParams.get('v')
      
      if (ip && port && pin) {
        return {
          ip,
          port: parseInt(port),
          pin,
          v: version || '1.0'
        }
      }
    }
    
    return null
  } catch (error) {
    return null
  }
}