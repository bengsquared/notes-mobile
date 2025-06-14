'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import QrScanner from 'qr-scanner'

interface QRScannerFullscreenProps {
  onScan: (data: string) => void
  onError?: (error: string) => void
  onClose: () => void
}

export function QRScannerFullscreen({ onScan, onError, onClose }: QRScannerFullscreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const qrScannerRef = useRef<QrScanner | null>(null)
  const isInitializingRef = useRef(false)

  useEffect(() => {
    let mounted = true
    let scannerInstance: QrScanner | null = null

    const initScanner = async () => {
      if (!videoRef.current || !mounted || isInitializingRef.current) return

      isInitializingRef.current = true

      try {
        // Create QR scanner instance
        scannerInstance = new QrScanner(
          videoRef.current,
          (result) => {
            console.log('📱 QR Scanner: QR code detected:', result.data)
            
            // Stop scanning immediately after successful scan
            if (scannerInstance && mounted) {
              scannerInstance.stop()
            }
            
            onScan(result.data)
          },
          {
            onDecodeError: (error) => {
              // Ignore decode errors - these happen frequently when no QR code is visible
              console.debug('QR decode attempt failed:', error)
            },
            highlightScanRegion: true,
            highlightCodeOutline: true,
            // Prefer back camera on mobile
            preferredCamera: 'environment',
            // Higher resolution for better scanning
            calculateScanRegion: (video) => {
              // Use center 80% of video for scanning to improve performance
              const smallestDimension = Math.min(video.videoWidth, video.videoHeight)
              const scanRegionSize = Math.round(0.8 * smallestDimension)
              const offsetX = Math.round((video.videoWidth - scanRegionSize) / 2)
              const offsetY = Math.round((video.videoHeight - scanRegionSize) / 2)
              
              return {
                x: offsetX,
                y: offsetY,
                width: scanRegionSize,
                height: scanRegionSize,
              }
            },
          }
        )

        // Store reference only if component is still mounted
        if (mounted) {
          qrScannerRef.current = scannerInstance

          // Check camera permissions
          const hasCamera = await QrScanner.hasCamera()
          if (!hasCamera) {
            throw new Error('No camera found on this device')
          }

          // Start scanning only if still mounted
          await scannerInstance.start()
          
          setIsScanning(true)
          setScannerError(null)
          
          console.log('📱 QR Scanner: Scanner started successfully')
        } else {
          // Component unmounted before scanner could start
          scannerInstance.destroy()
        }
      } catch (error) {
        console.error('📱 QR Scanner: Failed to start:', error)
        
        if (mounted) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to start camera'
          setScannerError(errorMessage)
          onError?.(errorMessage)
        }
        
        // Clean up scanner instance if error occurred
        if (scannerInstance) {
          try {
            scannerInstance.destroy()
          } catch (destroyError) {
            console.error('Error destroying scanner:', destroyError)
          }
        }
      } finally {
        isInitializingRef.current = false
      }
    }

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(() => {
      if (mounted) {
        initScanner()
      }
    }, 100)

    // Cleanup
    return () => {
      mounted = false
      clearTimeout(timeoutId)
      isInitializingRef.current = false
      
      // Clean up scanner instance
      if (qrScannerRef.current) {
        try {
          qrScannerRef.current.stop()
          qrScannerRef.current.destroy()
        } catch (error) {
          console.error('Error cleaning up scanner:', error)
        }
        qrScannerRef.current = null
      }
      
      // Also clean up local scanner instance if it exists
      if (scannerInstance) {
        try {
          scannerInstance.stop()
          scannerInstance.destroy()
        } catch (error) {
          console.error('Error cleaning up scanner instance:', error)
        }
      }
    }
  }, [onScan, onError])

  const handleClose = useCallback(() => {
    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop()
        qrScannerRef.current.destroy()
        qrScannerRef.current = null
      } catch (error) {
        console.error('Error stopping scanner on close:', error)
      }
    }
    onClose()
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Video element - full screen */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      
      {/* UI Overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Semi-transparent overlay with cutout */}
        <div className="absolute inset-0">
          {/* Top shadow */}
          <div className="absolute top-0 left-0 right-0 h-[20%] bg-black bg-opacity-60" />
          
          {/* Middle section with cutout */}
          <div className="absolute top-[20%] left-0 right-0 h-[60%] flex">
            {/* Left shadow */}
            <div className="flex-1 bg-black bg-opacity-60" />
            
            {/* Center transparent area with border */}
            <div className="relative w-[80%] max-w-[300px]">
              <div className="absolute inset-0">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-12 h-12">
                  <div className="absolute top-0 left-0 w-full h-1 bg-white rounded-full" />
                  <div className="absolute top-0 left-0 w-1 h-full bg-white rounded-full" />
                </div>
                <div className="absolute top-0 right-0 w-12 h-12">
                  <div className="absolute top-0 right-0 w-full h-1 bg-white rounded-full" />
                  <div className="absolute top-0 right-0 w-1 h-full bg-white rounded-full" />
                </div>
                <div className="absolute bottom-0 left-0 w-12 h-12">
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-white rounded-full" />
                  <div className="absolute bottom-0 left-0 w-1 h-full bg-white rounded-full" />
                </div>
                <div className="absolute bottom-0 right-0 w-12 h-12">
                  <div className="absolute bottom-0 right-0 w-full h-1 bg-white rounded-full" />
                  <div className="absolute bottom-0 right-0 w-1 h-full bg-white rounded-full" />
                </div>
              </div>
            </div>
            
            {/* Right shadow */}
            <div className="flex-1 bg-black bg-opacity-60" />
          </div>
          
          {/* Bottom shadow */}
          <div className="absolute bottom-0 left-0 right-0 h-[20%] bg-black bg-opacity-60" />
        </div>
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-safe">
          <div className="p-6">
            <h2 className="text-white text-2xl font-semibold text-center mb-2">
              Scan QR Code
            </h2>
            <p className="text-white text-center text-sm opacity-90">
              Position the QR code within the frame
            </p>
          </div>
        </div>
        
        {/* Error message */}
        {scannerError && (
          <div className="absolute top-1/2 left-4 right-4 transform -translate-y-1/2">
            <div className="bg-red-500 text-white p-4 rounded-lg text-center">
              <p className="font-semibold">Camera Error</p>
              <p className="text-sm mt-1">{scannerError}</p>
            </div>
          </div>
        )}
        
        {/* Scanning indicator */}
        {isScanning && !scannerError && (
          <div className="absolute bottom-32 left-0 right-0 flex justify-center">
            <div className="bg-white bg-opacity-90 rounded-full px-6 py-3">
              <div className="flex items-center space-x-3">
                <div className="flex space-x-1">
                  <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full" />
                  <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full animation-delay-150" />
                  <div className="animate-pulse w-2 h-2 bg-blue-500 rounded-full animation-delay-300" />
                </div>
                <span className="text-sm font-medium text-gray-800">Scanning...</span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Close button */}
      <button
        onClick={handleClose}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white text-black px-8 py-3 rounded-full font-medium shadow-lg hover:bg-gray-100 active:bg-gray-200 pointer-events-auto transition-colors"
      >
        Cancel
      </button>
      
      {/* Add animation delays */}
      <style jsx>{`
        .animation-delay-150 {
          animation-delay: 150ms;
        }
        .animation-delay-300 {
          animation-delay: 300ms;
        }
      `}</style>
    </div>
  )
}