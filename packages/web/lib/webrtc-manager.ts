/**
 * Robust WebRTC Manager for Mobile Web to Desktop App Communication
 * 
 * Features:
 * - Perfect negotiation pattern
 * - Cross-browser compatibility with adapter.js
 * - Safari mobile rollback workaround
 * - Comprehensive error handling
 * - Network condition detection
 * - Automatic reconnection
 * - Connection health monitoring
 */

// Import adapter.js for cross-browser compatibility
import 'webrtc-adapter'

// Types
export interface SignalingMessage {
  type: 'getConnectionCode' | 'offer' | 'answer' | 'iceCandidate' | 'ping' | 'error'
  pin?: string
  code?: string
  offer?: RTCSessionDescriptionInit
  answer?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  error?: string
}

export interface TransferData {
  type: 'notes-transfer'
  notes: any[]
  totalSize: number
  deviceName: string
  timestamp: number
  checksum?: string
}

export interface WebRTCManagerConfig {
  signalingUrl?: string
  signalingPort?: number
  iceServers?: RTCIceServer[]
  dataChannelConfig?: RTCDataChannelInit
  connectionTimeout?: number
  reconnectAttempts?: number
  polite?: boolean
}

export interface WebRTCManagerEvents {
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
  onDataChannelOpen: () => void
  onDataChannelClose: () => void
  onDataReceived: (data: any) => void
  onTransferProgress: (progress: number) => void
  onError: (error: Error) => void
  onSignalingError: (error: Error) => void
}

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private config: Required<WebRTCManagerConfig>
  private events: Partial<WebRTCManagerEvents>
  
  // Connection state
  private connectionCode: string | null = null
  private isPolite: boolean
  private makingOffer = false
  private ignoreOffer = false
  private isSettingRemoteAnswerPending = false
  
  // Data transfer state
  private receivedData = ''
  private sendQueue: string[] = []
  private transferStats = { sent: 0, received: 0, total: 0 }
  
  // Health monitoring
  private healthCheckInterval: NodeJS.Timeout | null = null
  private lastPingTime = 0
  private connectionAttempts = 0
  
  // Safari workaround
  private isSafariMobile = false

  constructor(config: WebRTCManagerConfig = {}, events: Partial<WebRTCManagerEvents> = {}) {
    this.config = {
      signalingUrl: config.signalingUrl || this.getDefaultSignalingUrl(),
      signalingPort: config.signalingPort || (process.env.NODE_ENV === 'development' ? 8081 : 8080),
      iceServers: config.iceServers || this.getDefaultIceServers(),
      dataChannelConfig: config.dataChannelConfig || { ordered: true, maxRetransmits: 3 },
      connectionTimeout: config.connectionTimeout || 30000,
      reconnectAttempts: config.reconnectAttempts || 3,
      polite: config.polite || true
    }
    
    this.events = events
    this.isPolite = this.config.polite
    this.isSafariMobile = this.detectSafariMobile()
    
    console.log('WebRTC Manager initialized', {
      isSafariMobile: this.isSafariMobile,
      isPolite: this.isPolite,
      config: this.config
    })
  }

  private detectSafariMobile(): boolean {
    const ua = navigator.userAgent
    return /iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua)
  }

  private getDefaultSignalingUrl(): string {
    // Check if we have an environment variable set
    if (process.env.NEXT_PUBLIC_SIGNALING_URL) {
      return process.env.NEXT_PUBLIC_SIGNALING_URL
    }
    
    // For mobile devices, we can't use localhost
    // The user needs to provide the desktop IP
    const port = process.env.NODE_ENV === 'development' ? 8081 : 8080
    
    // If we're on localhost, assume desktop development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return `http://localhost:${port}/signal`
    }
    
    // For mobile or other hosts, return empty - will need to be configured
    console.warn('No signaling URL configured. Please set NEXT_PUBLIC_SIGNALING_URL or provide desktop IP.')
    return `http://localhost:${port}/signal` // Fallback, but will likely fail
  }

  private getDefaultIceServers(): RTCIceServer[] {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ]
  }

  /**
   * Initialize WebRTC connection with perfect negotiation pattern
   */
  async initializeConnection(): Promise<void> {
    try {
      this.cleanup()
      
      // Create peer connection with robust configuration
      this.pc = new RTCPeerConnection({
        iceServers: this.config.iceServers,
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      })

      // Set up perfect negotiation pattern
      this.setupPerfectNegotiation()
      
      // Set up data channel handling
      this.setupDataChannel()
      
      // Set up connection monitoring
      this.setupConnectionMonitoring()
      
      console.log('WebRTC connection initialized successfully')
      
    } catch (error) {
      console.error('Failed to initialize WebRTC connection:', error)
      this.events.onError?.(error as Error)
      throw error
    }
  }

  /**
   * Perfect negotiation pattern implementation with Safari mobile workaround
   */
  private setupPerfectNegotiation(): void {
    if (!this.pc) return

    // Handle negotiation needed (perfect negotiation)
    this.pc.onnegotiationneeded = async () => {
      try {
        console.log('🤝 WEBRTC: Negotiation needed event fired')
        console.log(`🤝 WEBRTC: Currently making offer: ${this.makingOffer}`)
        console.log(`🤝 WEBRTC: Connection code: ${this.connectionCode}`)
        console.log(`🤝 WEBRTC: Signaling state: ${this.pc!.signalingState}`)
        
        this.makingOffer = true
        
        console.log('📝 WEBRTC: Creating and setting local description...')
        await this.pc!.setLocalDescription()
        console.log('✅ WEBRTC: Local description set:', this.pc!.localDescription?.type)
        
        if (this.connectionCode) {
          console.log('📤 WEBRTC: Sending offer to desktop...')
          const offerMessage = {
            type: 'offer',
            code: this.connectionCode,
            offer: this.pc!.localDescription!
          }
          console.log('📤 WEBRTC: Offer message:', offerMessage)
          
          const response = await this.sendSignalingMessage(offerMessage)
          console.log('📥 WEBRTC: Offer response:', response)
        } else {
          console.log('⚠️ WEBRTC: No connection code available, cannot send offer')
        }
      } catch (error) {
        console.error('❌ WEBRTC: Error in negotiation:', error)
        this.events.onError?.(error as Error)
      } finally {
        this.makingOffer = false
        console.log('🏁 WEBRTC: Negotiation attempt completed')
      }
    }

    // Handle ICE candidates
    this.pc.onicecandidate = async (event) => {
      console.log('🧊 WEBRTC: ICE candidate event:', event.candidate ? 'candidate found' : 'candidate gathering complete')
      
      if (event.candidate && this.connectionCode) {
        console.log('📤 WEBRTC: Sending ICE candidate to desktop...')
        try {
          const candidateMessage = {
            type: 'iceCandidate',
            code: this.connectionCode,
            candidate: event.candidate
          }
          console.log('📤 WEBRTC: ICE candidate message:', candidateMessage)
          
          await this.sendSignalingMessage(candidateMessage)
          console.log('✅ WEBRTC: ICE candidate sent successfully')
        } catch (error) {
          console.error('❌ WEBRTC: Failed to send ICE candidate:', error)
        }
      } else if (!this.connectionCode) {
        console.log('⚠️ WEBRTC: Cannot send ICE candidate - no connection code')
      }
    }

    // Handle ICE connection state changes
    this.pc.oniceconnectionstatechange = () => {
      console.log('🧊 WEBRTC: ICE connection state changed:', this.pc!.iceConnectionState)
      
      if (this.pc!.iceConnectionState === 'failed') {
        console.log('❌ WEBRTC: ICE connection failed')
        this.handleConnectionFailure()
      } else if (this.pc!.iceConnectionState === 'connected') {
        console.log('✅ WEBRTC: ICE connection established')
        this.connectionAttempts = 0
        this.startHealthCheck()
      } else if (this.pc!.iceConnectionState === 'checking') {
        console.log('🔍 WEBRTC: ICE connectivity checking...')
      } else if (this.pc!.iceConnectionState === 'completed') {
        console.log('🎉 WEBRTC: ICE connection completed')
      }
    }

    // Handle connection state changes
    this.pc.onconnectionstatechange = () => {
      console.log('🔗 WEBRTC: Connection state changed:', this.pc!.connectionState)
      this.events.onConnectionStateChange?.(this.pc!.connectionState)
      
      if (this.pc!.connectionState === 'connected') {
        console.log('🎉 WEBRTC: Peer connection established!')
      } else if (this.pc!.connectionState === 'connecting') {
        console.log('🔄 WEBRTC: Peer connection in progress...')
      } else if (this.pc!.connectionState === 'failed') {
        console.log('❌ WEBRTC: Peer connection failed')
        this.handleConnectionFailure()
      } else if (this.pc!.connectionState === 'closed') {
        console.log('🚪 WEBRTC: Peer connection closed')
        this.cleanup()
      }
    }
  }

  /**
   * Set up data channel with proper error handling
   */
  private setupDataChannel(): void {
    if (!this.pc) return

    // Create data channel if we're the initiator
    if (!this.isPolite) {
      this.dataChannel = this.pc.createDataChannel('notes-transfer', this.config.dataChannelConfig)
      this.setupDataChannelEvents(this.dataChannel)
    }

    // Handle incoming data channels
    this.pc.ondatachannel = (event) => {
      console.log('Received data channel:', event.channel.label)
      this.dataChannel = event.channel
      this.setupDataChannelEvents(this.dataChannel)
    }
  }

  /**
   * Set up data channel event handlers
   */
  private setupDataChannelEvents(channel: RTCDataChannel): void {
    console.log('📺 WEBRTC: Setting up data channel events for:', channel.label)
    console.log('📺 WEBRTC: Data channel state:', channel.readyState)
    
    channel.onopen = () => {
      console.log('📺 WEBRTC: Data channel opened!', channel.readyState)
      console.log('🎉 WEBRTC: Ready for data transfer!')
      this.events.onDataChannelOpen?.()
    }

    channel.onclose = () => {
      console.log('📺 WEBRTC: Data channel closed')
      this.events.onDataChannelClose?.()
    }

    channel.onerror = (error) => {
      console.error('📺 WEBRTC: Data channel error:', error)
      this.events.onError?.(new Error('Data channel error'))
    }

    channel.onmessage = (event) => {
      console.log('📺 WEBRTC: Data channel message received:', typeof event.data === 'string' ? event.data.slice(0, 100) + '...' : 'binary data')
      this.handleDataChannelMessage(event.data)
    }

    // Set up buffered amount monitoring
    const monitorBuffer = () => {
      if (channel.readyState === 'open' && channel.bufferedAmount > 0) {
        console.log('Data channel buffered amount:', channel.bufferedAmount)
        setTimeout(monitorBuffer, 100)
      }
    }
    
    channel.addEventListener('bufferedamountlow', () => {
      console.log('Buffer amount low, continuing send queue')
      this.processSendQueue()
    })
  }

  /**
   * Set up connection health monitoring
   */
  private setupConnectionMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      if (this.dataChannel?.readyState === 'open') {
        this.sendPing()
      }
    }, 10000) // Ping every 10 seconds
  }

  /**
   * Connect to desktop using PIN with retry logic
   */
  async connectToDesktop(pin: string): Promise<void> {
    if (!pin || pin.length !== 6) {
      throw new Error('Invalid PIN format')
    }

    this.connectionAttempts++
    
    try {
      console.log(`🚀 WEBRTC: Starting connection attempt ${this.connectionAttempts} with PIN: ${pin}`)
      console.log(`🔧 WEBRTC: Using signaling URL: ${this.config.signalingUrl}`)
      console.log(`🔧 WEBRTC: Polite peer: ${this.isPolite}`)
      console.log(`🔧 WEBRTC: Safari mobile: ${this.isSafariMobile}`)
      
      console.log('📡 WEBRTC: Initializing connection...')
      await this.initializeConnection()
      console.log('✅ WEBRTC: Connection initialized successfully')
      
      // Get connection code from desktop
      console.log('📡 WEBRTC: Requesting connection code from desktop...')
      const codeRequest = {
        type: 'getConnectionCode',
        pin: pin
      }
      console.log('📤 WEBRTC: Sending signaling message:', codeRequest)
      
      const codeResponse = await this.sendSignalingMessage(codeRequest)
      console.log('📥 WEBRTC: Received response:', codeResponse)

      if (!codeResponse.success) {
        throw new Error(codeResponse.error || 'Invalid PIN or desktop not available')
      }

      this.connectionCode = codeResponse.code
      console.log('🔑 WEBRTC: Got connection code:', this.connectionCode)

      // Since we're polite, we need to create a data channel to trigger negotiation
      console.log('🔗 WEBRTC: Creating data channel as polite peer...')
      this.dataChannel = this.pc!.createDataChannel('notes-transfer', this.config.dataChannelConfig)
      this.setupDataChannelEvents(this.dataChannel)
      console.log('✅ WEBRTC: Data channel created, waiting for negotiation...')

    } catch (error) {
      console.error('❌ WEBRTC: Failed to connect to desktop:', error)
      
      if (this.connectionAttempts < this.config.reconnectAttempts) {
        console.log(`🔄 WEBRTC: Retrying connection in 2 seconds... (${this.connectionAttempts}/${this.config.reconnectAttempts})`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        return this.connectToDesktop(pin)
      }
      
      console.error('💥 WEBRTC: Max retry attempts reached')
      this.events.onError?.(error as Error)
      throw error
    }
  }

  /**
   * Handle incoming signaling messages with perfect negotiation
   */
  async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    if (!this.pc) return

    try {
      if (message.type === 'offer') {
        console.log('Received offer')
        
        const offerCollision = (message.offer && this.makingOffer) || this.pc.signalingState !== 'stable'
        this.ignoreOffer = !this.isPolite && offerCollision
        
        if (this.ignoreOffer) {
          console.log('Ignoring offer due to collision (impolite peer)')
          return
        }

        this.isSettingRemoteAnswerPending = message.offer.type === 'answer'
        
        try {
          await this.pc.setRemoteDescription(message.offer)
        } catch (error) {
          // Safari mobile rollback workaround
          if (this.isSafariMobile && error.name === 'InvalidStateError') {
            console.log('Safari rollback error detected, creating new connection')
            await this.handleSafariRollbackError()
            return
          }
          throw error
        }
        
        this.isSettingRemoteAnswerPending = false

        if (message.offer.type === 'offer') {
          await this.pc.setLocalDescription()
          
          if (this.connectionCode) {
            await this.sendSignalingMessage({
              type: 'answer',
              code: this.connectionCode,
              answer: this.pc.localDescription!
            })
          }
        }
        
      } else if (message.type === 'answer') {
        console.log('Received answer')
        
        if (!this.isSettingRemoteAnswerPending) {
          await this.pc.setRemoteDescription(message.answer!)
        }
        
      } else if (message.type === 'iceCandidate') {
        try {
          await this.pc.addIceCandidate(message.candidate)
        } catch (error) {
          if (!this.ignoreOffer) {
            console.error('Error adding ICE candidate:', error)
          }
        }
      }
      
    } catch (error) {
      console.error('Error handling signaling message:', error)
      this.events.onSignalingError?.(error as Error)
    }
  }

  /**
   * Safari mobile rollback error workaround
   */
  private async handleSafariRollbackError(): Promise<void> {
    console.log('Handling Safari rollback error by recreating connection')
    
    const oldConnectionCode = this.connectionCode
    await this.cleanup()
    await this.initializeConnection()
    this.connectionCode = oldConnectionCode
    
    // Reset negotiation state
    this.makingOffer = false
    this.ignoreOffer = false
    this.isSettingRemoteAnswerPending = false
  }

  /**
   * Send data with chunking and flow control
   */
  async sendData(data: TransferData): Promise<void> {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not ready')
    }

    try {
      // Add checksum for integrity
      const dataWithChecksum = {
        ...data,
        checksum: this.calculateChecksum(JSON.stringify(data))
      }
      
      const dataStr = JSON.stringify(dataWithChecksum)
      
      // Send transfer start signal
      this.dataChannel.send('TRANSFER_START')
      
      // Send data in chunks with flow control
      const chunkSize = 16384 // 16KB chunks
      const chunks = Math.ceil(dataStr.length / chunkSize)
      this.transferStats = { sent: 0, received: 0, total: chunks }
      
      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, dataStr.length)
        const chunk = dataStr.slice(start, end)
        
        await this.sendChunkWithFlowControl(chunk)
        
        this.transferStats.sent++
        const progress = (this.transferStats.sent / this.transferStats.total) * 90
        this.events.onTransferProgress?.(progress)
      }
      
      // Send transfer end signal
      this.dataChannel.send('TRANSFER_END')
      this.events.onTransferProgress?.(100)
      
      console.log('Data transfer completed successfully')
      
    } catch (error) {
      console.error('Failed to send data:', error)
      this.events.onError?.(error as Error)
      throw error
    }
  }

  /**
   * Send chunk with flow control
   */
  private async sendChunkWithFlowControl(chunk: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.dataChannel) {
        reject(new Error('Data channel not available'))
        return
      }

      const send = () => {
        try {
          if (this.dataChannel!.bufferedAmount > 65536) { // 64KB buffer limit
            setTimeout(send, 10)
            return
          }
          
          this.dataChannel!.send(chunk)
          resolve()
        } catch (error) {
          reject(error)
        }
      }
      
      send()
    })
  }

  /**
   * Handle incoming data channel messages
   */
  private handleDataChannelMessage(data: string): void {
    try {
      if (data === 'TRANSFER_START') {
        console.log('Transfer started')
        this.receivedData = ''
        this.transferStats = { sent: 0, received: 0, total: 0 }
        return
      }

      if (data === 'TRANSFER_END') {
        console.log('Transfer ended, processing data')
        
        try {
          const transferData = JSON.parse(this.receivedData)
          
          // Verify checksum if present
          if (transferData.checksum) {
            const { checksum, ...dataToVerify } = transferData
            const calculatedChecksum = this.calculateChecksum(JSON.stringify(dataToVerify))
            
            if (checksum !== calculatedChecksum) {
              throw new Error('Data integrity check failed')
            }
          }
          
          this.events.onDataReceived?.(transferData)
          this.events.onTransferProgress?.(100)
          
        } catch (error) {
          console.error('Error processing received data:', error)
          this.events.onError?.(error as Error)
        }
        return
      }

      if (data === 'PING') {
        this.dataChannel?.send('PONG')
        return
      }

      if (data === 'PONG') {
        this.lastPingTime = Date.now()
        return
      }

      // Accumulate data chunks
      this.receivedData += data
      this.transferStats.received++
      
      // Estimate progress based on received data
      if (this.transferStats.total > 0) {
        const progress = (this.transferStats.received / this.transferStats.total) * 90
        this.events.onTransferProgress?.(progress)
      }
      
    } catch (error) {
      console.error('Error handling data channel message:', error)
      this.events.onError?.(error as Error)
    }
  }

  /**
   * Send signaling message with retry logic
   */
  private async sendSignalingMessage(message: SignalingMessage): Promise<any> {
    const maxRetries = 3
    let lastError: Error | null = null
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(this.config.signalingUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
          signal: AbortSignal.timeout(5000) // 5 second timeout
        })

        if (!response.ok) {
          throw new Error(`Signaling failed: ${response.status} ${response.statusText}`)
        }

        return await response.json()
        
      } catch (error) {
        lastError = error as Error
        console.error(`Signaling attempt ${i + 1} failed:`, error)
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
        }
      }
    }
    
    this.events.onSignalingError?.(lastError!)
    throw lastError
  }

  /**
   * Handle connection failures with automatic recovery
   */
  private async handleConnectionFailure(): Promise<void> {
    console.log('Connection failure detected')
    
    if (this.connectionAttempts < this.config.reconnectAttempts) {
      console.log(`Attempting to reconnect... (${this.connectionAttempts}/${this.config.reconnectAttempts})`)
      
      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      try {
        await this.initializeConnection()
        this.connectionAttempts++
      } catch (error) {
        console.error('Reconnection failed:', error)
        this.events.onError?.(error as Error)
      }
    } else {
      console.log('Max reconnection attempts reached')
      this.events.onError?.(new Error('Connection failed after maximum retry attempts'))
    }
  }

  /**
   * Send ping for connection health monitoring
   */
  private sendPing(): void {
    if (this.dataChannel?.readyState === 'open') {
      this.dataChannel.send('PING')
      
      // Check for pong response
      setTimeout(() => {
        const timeSinceLastPong = Date.now() - this.lastPingTime
        if (timeSinceLastPong > 15000) { // No pong for 15 seconds
          console.log('Connection health check failed, connection may be dead')
          this.handleConnectionFailure()
        }
      }, 5000)
    }
  }

  /**
   * Calculate simple checksum for data integrity
   */
  private calculateChecksum(data: string): string {
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash.toString(16)
  }

  /**
   * Get current connection statistics
   */
  getConnectionStats(): any {
    return {
      connectionState: this.pc?.connectionState,
      iceConnectionState: this.pc?.iceConnectionState,
      dataChannelState: this.dataChannel?.readyState,
      transferStats: this.transferStats,
      connectionAttempts: this.connectionAttempts,
      isSafariMobile: this.isSafariMobile
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up WebRTC manager')
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
    
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }
    
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    
    this.connectionCode = null
    this.receivedData = ''
    this.sendQueue = []
    this.transferStats = { sent: 0, received: 0, total: 0 }
    this.connectionAttempts = 0
    this.makingOffer = false
    this.ignoreOffer = false
    this.isSettingRemoteAnswerPending = false
  }

  /**
   * Process queued sends (for future use)
   */
  private processSendQueue(): void {
    while (this.sendQueue.length > 0 && this.dataChannel?.bufferedAmount < 32768) {
      const chunk = this.sendQueue.shift()!
      this.dataChannel?.send(chunk)
    }
  }
}