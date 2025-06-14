/**
 * Simple WebRTC Manager for Direct P2P Connection
 * 
 * This version doesn't use a signaling server. Instead:
 * 1. User enters PIN on mobile to start connection
 * 2. Mobile creates offer and displays it as QR code or text
 * 3. Desktop scans/enters the offer
 * 4. Desktop creates answer and displays it
 * 5. Mobile enters the answer to complete connection
 */

export interface TransferData {
  type: 'notes-transfer'
  notes: any[]
  totalSize: number
  deviceName: string
  timestamp: number
}

export interface WebRTCManagerConfig {
  iceServers?: RTCIceServer[]
  dataChannelConfig?: RTCDataChannelInit
}

export interface WebRTCManagerEvents {
  onConnectionStateChange: (state: RTCPeerConnectionState) => void
  onDataChannelOpen: () => void
  onDataChannelClose: () => void
  onTransferProgress: (progress: { sent: number; total: number }) => void
  onTransferComplete: () => void
  onError: (error: Error) => void
  onOfferReady: (offer: string) => void
  onAnswerNeeded: () => void
}

export class SimpleWebRTCManager {
  private pc: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private config: WebRTCManagerConfig
  private events: WebRTCManagerEvents
  
  // Connection state
  private connectionState: RTCPeerConnectionState = 'new'
  
  constructor(config: WebRTCManagerConfig, events: WebRTCManagerEvents) {
    this.config = config
    this.events = events
    
    console.log('📱 MOBILE WebRTC: Simple manager initialized')
  }

  // Initialize connection and create offer
  async initializeConnection(): Promise<void> {
    console.log('📱 MOBILE WebRTC: Initializing connection')
    
    this.pc = new RTCPeerConnection({
      iceServers: this.config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    })
    
    // Set up event handlers
    this.pc.onconnectionstatechange = () => {
      const state = this.pc!.connectionState
      console.log('📱 MOBILE WebRTC: Connection state changed to:', state)
      this.connectionState = state
      this.events.onConnectionStateChange(state)
    }
    
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('📱 MOBILE WebRTC: ICE candidate generated')
        // ICE candidates are included in the offer/answer, so we don't need to send them separately
      } else {
        console.log('📱 MOBILE WebRTC: ICE gathering complete')
      }
    }
    
    // Create data channel
    this.dataChannel = this.pc.createDataChannel('notes-transfer', {
      ordered: true,
      ...this.config.dataChannelConfig
    })
    
    this.setupDataChannelEvents()
    
    // Create offer
    console.log('📱 MOBILE WebRTC: Creating offer...')
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    
    // Wait for ICE gathering to complete
    await this.waitForICEGathering()
    
    // Get the complete offer with ICE candidates
    const completeOffer = this.pc.localDescription!
    const offerString = JSON.stringify(completeOffer)
    
    console.log('📱 MOBILE WebRTC: Offer ready')
    this.events.onOfferReady(offerString)
  }

  // Handle answer from desktop
  async handleAnswer(answerString: string): Promise<void> {
    console.log('📱 MOBILE WebRTC: Received answer from desktop')
    
    if (!this.pc) {
      throw new Error('No peer connection available')
    }
    
    try {
      const answer = JSON.parse(answerString)
      await this.pc.setRemoteDescription(answer)
      console.log('📱 MOBILE WebRTC: Answer processed successfully')
    } catch (error) {
      console.error('📱 MOBILE WebRTC: Error processing answer:', error)
      this.events.onError(new Error('Failed to process answer from desktop'))
    }
  }

  // Send notes to desktop
  async sendNotes(notes: any[]): Promise<void> {
    console.log(`📱 MOBILE WebRTC: Sending ${notes.length} notes to desktop`)
    
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
    
    console.log('📱 MOBILE WebRTC: Transfer completed successfully')
    this.events.onTransferComplete()
    
    // Clean up connection after successful transfer
    setTimeout(() => {
      console.log('📱 MOBILE WebRTC: Cleaning up after successful transfer')
      this.disconnect()
    }, 1000)
  }

  private setupDataChannelEvents(): void {
    if (!this.dataChannel) return
    
    this.dataChannel.onopen = () => {
      console.log('📱 MOBILE WebRTC: Data channel opened')
      this.events.onDataChannelOpen()
    }
    
    this.dataChannel.onclose = () => {
      console.log('📱 MOBILE WebRTC: Data channel closed')
      this.events.onDataChannelClose()
    }
    
    this.dataChannel.onerror = (error) => {
      // Only report errors if we're not in the process of disconnecting
      if (this.pc && this.pc.connectionState !== 'closed' && this.pc.connectionState !== 'disconnected') {
        console.error('📱 MOBILE WebRTC: Data channel error:', error)
        this.events.onError(new Error('Data channel error'))
      } else {
        console.log('📱 MOBILE WebRTC: Data channel error during cleanup (expected)')
      }
    }
  }

  private async waitForICEGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc!.iceGatheringState === 'complete') {
        resolve()
        return
      }
      
      const checkState = () => {
        if (this.pc!.iceGatheringState === 'complete') {
          resolve()
        } else {
          setTimeout(checkState, 100)
        }
      }
      
      checkState()
    })
  }

  getConnectionState(): RTCPeerConnectionState {
    return this.connectionState
  }

  disconnect(): void {
    console.log('📱 MOBILE WebRTC: Disconnecting')
    
    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }
    
    if (this.pc) {
      this.pc.close()
      this.pc = null
    }
    
    this.connectionState = 'closed'
    this.events.onConnectionStateChange('closed')
  }
}