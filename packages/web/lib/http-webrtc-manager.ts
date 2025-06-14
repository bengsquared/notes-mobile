/**
 * HTTP-based WebRTC Manager for Web App
 * 
 * This discovers the desktop app on the local network via HTTP
 * and uses it for WebRTC signaling instead of manual copy/paste.
 */

interface Note {
  id: string
  content: string
  createdAt: string
  location?: {
    lat: number
    lng: number
  }
}

interface TransferData {
  type: 'notes-transfer'
  notes: Note[]
  totalSize: number
  deviceName: string
  timestamp: number
}

export interface HTTPWebRTCManagerEvents {
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
  onDataChannelOpen: () => void
  onDataChannelClose: () => void
  onTransferProgress: (progress: { sent: number; total: number }) => void
  onTransferComplete: () => void
  onError: (error: Error) => void
  onDesktopDiscovered: (address: string) => void
  onOfferSent: () => void
  onConnected: () => void
  onCertificateError?: (httpsUrl: string) => void
}

export class HTTPWebRTCManager {
  private pc: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private events: HTTPWebRTCManagerEvents
  private desktopAddress: string | null = null
  private desktopProtocol: string = 'http'
  private sessionId: string
  private isDisconnecting: boolean = false
  private certificateErrorReported: boolean = false
  private lastCertificateErrorUrl: string | null = null
  
  constructor(events: HTTPWebRTCManagerEvents) {
    this.events = events
    this.sessionId = Math.random().toString(36).substr(2, 9)
    
    console.log('📱 HTTP WebRTC: Manager initialized')
  }

  // Discover desktop app on local network
  async discoverDesktop(): Promise<string> {
    console.log('📱 HTTP WebRTC: Discovering desktop app...')
    
    // Reset certificate error state for new discovery
    this.certificateErrorReported = false
    this.lastCertificateErrorUrl = null
    
    // Common local network patterns (real IP testing)
    const commonRanges = [
      '192.168.86.',  // Your network range
      '192.168.1.',
      '192.168.0.',
      '10.0.0.',
      '172.16.0.'
    ]
    
    const port = 8080
    const timeout = 1000 // 1 second timeout per attempt
    
    let totalAttempts = 0
    let rangeAttempts = 0
    
    for (const baseIP of commonRanges) {
      console.log(`📱 HTTP WebRTC: Scanning range ${baseIP}...`)
      rangeAttempts = 0
      
      if (baseIP.includes('.') && baseIP.endsWith('.')) {
        // Scan IP range
        for (let i = 1; i <= 254; i++) {
          const ip = `${baseIP}${i}`
          totalAttempts++
          rangeAttempts++
          
          try {
            const response = await this.tryDiscoverAt(ip, port, timeout)
            if (response) {
              console.log(`📱 HTTP WebRTC: Found desktop at ${response.protocol}://${ip}:${port}`)
              console.log(`📱 HTTP WebRTC: Discovery succeeded after ${totalAttempts} attempts`)
              this.desktopProtocol = response.protocol
              this.events.onDesktopDiscovered(`${ip}:${port}`)
              return `${ip}:${port}`
            }
          } catch (e) {
            // Log every 50th attempt to show progress
            if (rangeAttempts % 50 === 0) {
              console.log(`📱 HTTP WebRTC: Scanned ${rangeAttempts} IPs in ${baseIP} range...`)
            }
          }
        }
        console.log(`📱 HTTP WebRTC: Completed ${baseIP} range (${rangeAttempts} attempts)`)
      } else {
        // Try specific addresses
        try {
          totalAttempts++
          const response = await this.tryDiscoverAt(baseIP, port, timeout)
          if (response) {
            console.log(`📱 HTTP WebRTC: Found desktop at ${response.protocol}://${baseIP}:${port}`)
            console.log(`📱 HTTP WebRTC: Discovery succeeded after ${totalAttempts} attempts`)
            this.desktopProtocol = response.protocol
            this.events.onDesktopDiscovered(`${baseIP}:${port}`)
            return `${baseIP}:${port}`
          }
        } catch (e) {
          console.log(`📱 HTTP WebRTC: ${baseIP}:${port} not reachable:`, e.message)
        }
      }
    }
    
    console.error(`📱 HTTP WebRTC: Discovery failed after ${totalAttempts} attempts across all ranges`)
    
    // If we had certificate errors but overall discovery failed, surface the certificate guidance
    if (this.lastCertificateErrorUrl && this.events.onCertificateError && !this.certificateErrorReported) {
      console.log('📱 HTTP WebRTC: Surfacing certificate error since discovery failed')
      this.certificateErrorReported = true
      this.events.onCertificateError(this.lastCertificateErrorUrl)
    }
    
    throw new Error('Desktop app not found on local network')
  }

  private async tryDiscoverAt(ip: string, port: number, timeout: number): Promise<any> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    // Try HTTPS first, then fallback to HTTP
    const protocols = ['https', 'http']
    
    for (const protocol of protocols) {
      try {
        // For HTTPS with self-signed certificates, we need to handle certificate errors
        const fetchOptions: RequestInit = {
          method: 'GET',
          signal: controller.signal
        }

        // For self-signed certificates, we might get certificate errors
        // but we can't disable certificate validation in fetch API
        const response = await fetch(`${protocol}://${ip}:${port}/discover`, fetchOptions)
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          console.log(`📱 HTTP WebRTC: Response from ${protocol}://${ip}:${port}:`, data)
          if (data.status === 'available' && data.capabilities?.includes('webrtc-transfer')) {
            // Store the working protocol for later use
            data.protocol = protocol
            return data
          } else {
            console.log(`📱 HTTP WebRTC: ${protocol}://${ip}:${port} responded but wrong capabilities:`, data)
          }
        } else {
          console.log(`📱 HTTP WebRTC: ${protocol}://${ip}:${port} returned HTTP ${response.status}`)
        }
      } catch (error: any) {
        // Handle certificate errors specifically for HTTPS
        if (protocol === 'https' && (
          error.message.includes('certificate') || 
          error.message.includes('SSL') || 
          error.message.includes('TLS') ||
          error.message.includes('net::ERR_CERT_AUTHORITY_INVALID') ||
          error.message.includes('Failed to fetch')
        )) {
          console.log(`📱 HTTP WebRTC: ${protocol}://${ip}:${port} failed due to certificate issue: ${error.message}`)
          console.log(`📱 HTTP WebRTC: This is expected for self-signed certificates. User needs to accept certificate manually.`)
          
          // Remember certificate error for later reference
          const httpsUrl = `${protocol}://${ip}:${port}`
          this.lastCertificateErrorUrl = httpsUrl
          
          // Notify about certificate error so UI can guide user (only once per manager instance)
          if (this.events.onCertificateError && !this.certificateErrorReported) {
            this.certificateErrorReported = true
            this.events.onCertificateError(httpsUrl)
          }
          
          // Still continue to try HTTP as fallback
        } else {
          console.log(`📱 HTTP WebRTC: ${protocol}://${ip}:${port} failed: ${error.message}`)
        }
        continue
      }
    }
    
    clearTimeout(timeoutId)
    const errorMessage = 'All protocols failed'
    throw new Error(errorMessage)
  }

  // Connect to desktop using PIN
  async connectWithPIN(pin: string): Promise<void> {
    console.log(`📱 HTTP WebRTC: Connecting with PIN ${pin}`)
    
    // Discover desktop first
    this.desktopAddress = await this.discoverDesktop()
    
    // Continue with normal WebRTC setup
    await this.initializeWebRTCConnection(pin)
  }

  // Connect directly to desktop using QR code data
  async connectWithQRCode(qrData: { ip: string, port: number, pin: string }): Promise<void> {
    console.log(`📱 HTTP WebRTC: Connecting with QR code to ${qrData.ip}:${qrData.port}`)
    console.log('📱 HTTP WebRTC: Full QR connection data:', qrData)
    
    // Reset certificate error state for new connection
    this.certificateErrorReported = false
    this.lastCertificateErrorUrl = null
    
    // Skip discovery - use QR code IP directly
    this.desktopAddress = `${qrData.ip}:${qrData.port}`
    console.log('📱 HTTP WebRTC: Set desktop address to:', this.desktopAddress)
    
    // Verify desktop is actually there and detect protocol
    try {
      console.log('📱 HTTP WebRTC: Verifying desktop at address:', `${qrData.ip}:${qrData.port}`)
      const response = await this.tryDiscoverAt(qrData.ip, qrData.port, 3000)
      if (!response) {
        throw new Error('Desktop not found at QR code address')
      }
      this.desktopProtocol = response.protocol
      console.log(`📱 HTTP WebRTC: Desktop verified via QR code using ${this.desktopProtocol}`)
    } catch (error) {
      console.error('📱 HTTP WebRTC: QR verification failed:', error)
      
      // If we had certificate errors during QR verification, surface them
      if (this.lastCertificateErrorUrl && this.events.onCertificateError && !this.certificateErrorReported) {
        console.log('📱 HTTP WebRTC: Surfacing certificate error from QR verification')
        this.certificateErrorReported = true
        this.events.onCertificateError(this.lastCertificateErrorUrl)
      }
      
      throw new Error(`QR code connection failed: ${error.message}`)
    }
    
    // Continue with normal WebRTC setup (same as PIN method)
    await this.initializeWebRTCConnection(qrData.pin)
  }

  // Shared WebRTC initialization for both PIN and QR code methods
  private async initializeWebRTCConnection(pin: string): Promise<void> {
    // Initialize WebRTC
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })
    
    console.log('📱 HTTP WebRTC: RTCPeerConnection created')
    
    // Set up event handlers
    this.pc.onconnectionstatechange = () => {
      const state = this.pc!.connectionState
      console.log('📱 HTTP WebRTC: Connection state changed to:', state)
      this.events.onConnectionStateChange(state)
      
      if (state === 'connected') {
        this.events.onConnected()
      }
    }
    
    // Add ICE candidate logging
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('📱 HTTP WebRTC: ICE candidate:', event.candidate.candidate)
      } else {
        console.log('📱 HTTP WebRTC: ICE gathering finished (null candidate)')
      }
    }
    
    // Add ICE connection state logging
    this.pc.oniceconnectionstatechange = () => {
      console.log('📱 HTTP WebRTC: ICE connection state:', this.pc!.iceConnectionState)
    }
    
    // Create data channel
    this.dataChannel = this.pc.createDataChannel('notes-transfer', {
      ordered: true
    })
    
    this.setupDataChannelEvents()
    
    // Create offer
    console.log('📱 HTTP WebRTC: Creating offer...')
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    
    // Wait for ICE gathering
    await this.waitForICEGathering()
    
    // Send offer to desktop via HTTP
    const completeOffer = JSON.stringify(this.pc.localDescription!)
    
    console.log('📱 HTTP WebRTC: Sending offer to desktop...')
    const signalUrl = `${this.desktopProtocol}://${this.desktopAddress}/signal/${pin}`
    console.log('📱 HTTP WebRTC: Sending to URL:', signalUrl)
    console.log('📱 HTTP WebRTC: PIN being used:', pin)
    console.log('📱 HTTP WebRTC: Using protocol:', this.desktopProtocol)
    const response = await fetch(signalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'offer',
        data: completeOffer
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to send offer: ${response.status} ${response.statusText}`)
    }
    
    const result = await response.json()
    console.log('📱 HTTP WebRTC: Offer sent, response:', result)
    this.events.onOfferSent()
    
    // Poll for answer
    await this.pollForAnswer(pin)
  }

  private async pollForAnswer(pin: string): Promise<void> {
    console.log('📱 HTTP WebRTC: Polling for answer...')
    
    const maxAttempts = 30 // 30 seconds max
    let attempts = 0
    
    const poll = async (): Promise<void> => {
      try {
        const pollUrl = `${this.desktopProtocol}://${this.desktopAddress}/signal/${pin}`
        const response = await fetch(pollUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'answer-request',
            data: null
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          
          if (result.type === 'answer') {
            console.log('📱 HTTP WebRTC: Received answer from desktop')
            const answer = JSON.parse(result.data)
            await this.pc!.setRemoteDescription(answer)
            console.log('📱 HTTP WebRTC: Answer processed successfully')
            return
          }
        }
        
        // If no answer yet, poll again
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000) // Poll every second
        } else {
          throw new Error('Timeout waiting for answer from desktop')
        }
      } catch (error) {
        console.error('📱 HTTP WebRTC: Error polling for answer:', error)
        this.events.onError(error as Error)
      }
    }
    
    poll()
  }

  private setupDataChannelEvents(): void {
    if (!this.dataChannel) return
    
    this.dataChannel.onopen = () => {
      console.log('📱 HTTP WebRTC: Data channel opened')
      this.events.onDataChannelOpen()
    }
    
    this.dataChannel.onclose = () => {
      console.log('📱 HTTP WebRTC: Data channel closed')
      this.events.onDataChannelClose()
    }
    
    this.dataChannel.onerror = (error) => {
      // Only report errors if we're not intentionally disconnecting AND the connection is active
      const connectionState = this.pc?.connectionState
      const shouldReportError = !this.isDisconnecting && 
                               connectionState !== 'closed' && 
                               connectionState !== 'disconnected' &&
                               connectionState !== 'failed' &&
                               this.dataChannel?.readyState !== 'closed' &&
                               this.dataChannel?.readyState !== 'closing'
      
      if (shouldReportError) {
        console.error('📱 HTTP WebRTC: Data channel error:', error)
        this.events.onError(new Error('Data channel error'))
      } else {
        console.log('📱 HTTP WebRTC: Data channel error during cleanup/disconnection (expected)')
        console.log('📱 HTTP WebRTC: Connection state:', connectionState, 'Data channel state:', this.dataChannel?.readyState, 'Disconnecting:', this.isDisconnecting)
      }
    }
  }

  // Send notes to desktop
  async sendNotes(notes: Note[]): Promise<void> {
    console.log(`📱 HTTP WebRTC: Sending ${notes.length} notes to desktop`)
    
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready')
    }
    
    const transferData: TransferData = {
      type: 'notes-transfer',
      notes,
      totalSize: JSON.stringify(notes).length,
      deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Web Browser',
      timestamp: Date.now()
    }
    
    const dataString = JSON.stringify(transferData)
    const maxChunkSize = 16384 // 16KB chunks
    
    // Send start marker
    this.dataChannel.send('TRANSFER_START')
    
    // Send data in chunks
    let sent = 0
    for (let i = 0; i < dataString.length; i += maxChunkSize) {
      const chunk = dataString.slice(i, i + maxChunkSize)
      this.dataChannel.send(chunk)
      sent += chunk.length
      
      // Report progress
      this.events.onTransferProgress({ sent, total: dataString.length })
      
      // Small delay to prevent overwhelming the channel
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    
    // Send end marker
    this.dataChannel.send('TRANSFER_END')
    
    console.log('📱 HTTP WebRTC: Transfer completed successfully')
    this.events.onTransferComplete()
    
    // Set disconnecting flag immediately to suppress cleanup errors
    this.isDisconnecting = true
    
    // Clean up connection after successful transfer
    setTimeout(() => {
      console.log('📱 HTTP WebRTC: Cleaning up after successful transfer')
      this.disconnect()
    }, 1000)
  }

  private async waitForICEGathering(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('📱 HTTP WebRTC: Current ICE gathering state:', this.pc!.iceGatheringState)
      
      if (this.pc!.iceGatheringState === 'complete') {
        console.log('📱 HTTP WebRTC: ICE gathering already complete')
        resolve()
        return
      }
      
      // Set a timeout to prevent hanging forever
      const timeout = setTimeout(() => {
        console.log('📱 HTTP WebRTC: ICE gathering timeout - proceeding anyway')
        this.pc!.removeEventListener('icegatheringstatechange', onStateChange)
        resolve() // Resolve anyway, don't reject
      }, 5000) // 5 second timeout
      
      const onStateChange = () => {
        console.log('📱 HTTP WebRTC: ICE gathering state changed to:', this.pc!.iceGatheringState)
        if (this.pc!.iceGatheringState === 'complete') {
          clearTimeout(timeout)
          this.pc!.removeEventListener('icegatheringstatechange', onStateChange)
          console.log('📱 HTTP WebRTC: ICE gathering completed')
          resolve()
        }
      }
      
      this.pc!.addEventListener('icegatheringstatechange', onStateChange)
    })
  }

  disconnect(): void {
    console.log('📱 HTTP WebRTC: Disconnecting')
    
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }
    
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    
    this.desktopAddress = null
    this.desktopProtocol = 'http'
    this.certificateErrorReported = false
    this.lastCertificateErrorUrl = null
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.pc?.connectionState || 'new'
  }
}