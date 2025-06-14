/**
 * Simple WebRTC Manager for Desktop App (Manual Exchange)
 * 
 * This handles manual offer/answer exchange without a signaling server
 */

export interface WebRTCManagerConfig {
  iceServers: RTCIceServer[]
  deviceType: 'desktop' | 'mobile'
}

export interface WebRTCManagerEvents {
  onConnectionStateChange: (state: string) => void
  onDataReceived: (data: any) => void
  onError: (error: Error) => void
  onAnswerReady: (answer: string) => void
}

export class SimpleWebRTCManager {
  private pc: RTCPeerConnection | null = null
  private dataChannel: RTCDataChannel | null = null
  private config: WebRTCManagerConfig
  private events: WebRTCManagerEvents

  // Connection state
  private connectionState: RTCPeerConnectionState = 'new'
  private receivedData = ''

  constructor(config: WebRTCManagerConfig, events: WebRTCManagerEvents) {
    this.config = config
    this.events = events

    console.log('🖥️ DESKTOP WebRTC: Simple manager initialized for', config.deviceType)
  }

  private initializePeerConnection() {
    console.log('🖥️ DESKTOP WebRTC: Initializing peer connection')

    this.pc = new RTCPeerConnection({
      iceServers: this.config.iceServers
    })

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🖥️ DESKTOP WebRTC: ICE candidate generated')
      } else {
        console.log('🖥️ DESKTOP WebRTC: ICE gathering complete')
      }
    }

    this.pc.onconnectionstatechange = () => {
      const state = this.pc!.connectionState
      console.log('🖥️ DESKTOP WebRTC: Connection state changed to:', state)
      this.connectionState = state
      this.events.onConnectionStateChange(state)
      
      if (state === 'failed') {
        console.log('🖥️ DESKTOP WebRTC: Connection failed, attempting ICE restart')
        // Note: ICE restart would require re-negotiation, which is complex
        // For now, we'll let the application handle the failure
      }
    }

    this.pc.oniceconnectionstatechange = () => {
      const iceState = this.pc!.iceConnectionState
      console.log('🖥️ DESKTOP WebRTC: ICE connection state changed to:', iceState)
      
      if (iceState === 'failed' || iceState === 'disconnected') {
        console.log('🖥️ DESKTOP WebRTC: ICE connection issues detected')
      }
    }

    // Handle incoming data channels (from mobile)
    this.pc.ondatachannel = (event) => {
      console.log('🖥️ DESKTOP WebRTC: Received data channel')
      this.dataChannel = event.channel
      this.setupDataChannelEvents()
    }
  }

  // Handle offer from mobile and create answer
  async handleOffer(offerString: string): Promise<void> {
    console.log('🖥️ DESKTOP WebRTC: Handling offer from mobile')

    try {
      // Initialize if not already done
      if (!this.pc) {
        this.initializePeerConnection()
      }

      // Parse and set remote description
      const offer = JSON.parse(offerString)
      await this.pc!.setRemoteDescription(offer)

      console.log('🖥️ DESKTOP WebRTC: Creating answer...')
      const answer = await this.pc!.createAnswer()
      await this.pc!.setLocalDescription(answer)

      // Wait for ICE gathering to complete
      await this.waitForICEGathering()

      // Get the complete answer with ICE candidates
      const completeAnswer = this.pc!.localDescription!
      const answerString = JSON.stringify(completeAnswer)

      console.log('🖥️ DESKTOP WebRTC: Answer ready')
      this.events.onAnswerReady(answerString)

    } catch (error) {
      console.error('🖥️ DESKTOP WebRTC: Error handling offer:', error)
      this.events.onError(error as Error)
    }
  }

  private setupDataChannelEvents() {
    if (!this.dataChannel) return

    console.log('🖥️ DESKTOP WebRTC: Setting up data channel events')

    this.dataChannel.onopen = () => {
      console.log('🖥️ DESKTOP WebRTC: Data channel opened')
    }

    this.dataChannel.onclose = () => {
      console.log('🖥️ DESKTOP WebRTC: Data channel closed')
    }

    this.dataChannel.onerror = (error) => {
      // Only report errors if we're not in the process of disconnecting
      if (this.pc && this.pc.connectionState !== 'closed' && this.pc.connectionState !== 'disconnected') {
        console.error('🖥️ DESKTOP WebRTC: Data channel error:', error)
        this.events.onError(new Error('Data channel error'))
      } else {
        console.log('🖥️ DESKTOP WebRTC: Data channel error during cleanup (expected)')
      }
    }

    this.dataChannel.onmessage = (event) => {
      const data = event.data
      console.log('🖥️ DESKTOP WebRTC: Received message:', typeof data === 'string' ? data.slice(0, 50) + '...' : 'binary')

      if (data === 'TRANSFER_START') {
        console.log('🖥️ DESKTOP WebRTC: Transfer started')
        this.receivedData = ''
        return
      }

      if (data === 'TRANSFER_END') {
        console.log('🖥️ DESKTOP WebRTC: Transfer completed, processing data')
        try {
          const transferData = JSON.parse(this.receivedData)
          this.events.onDataReceived(transferData)

          // Clean up connection after processing data
          setTimeout(() => {
            console.log('🖥️ DESKTOP WebRTC: Cleaning up after successful transfer')
            this.disconnect()
          }, 500)
        } catch (error) {
          console.error('🖥️ DESKTOP WebRTC: Error parsing received data:', error)
          this.events.onError(new Error('Failed to parse received notes'))
        }
        return
      }

      // Accumulate data chunks
      this.receivedData += data
    }
  }

  private async waitForICEGathering(): Promise<void> {
    return new Promise((resolve) => {
      console.log('🖥️ DESKTOP WebRTC: Current ICE gathering state:', this.pc!.iceGatheringState)
      
      if (this.pc!.iceGatheringState === 'complete') {
        console.log('🖥️ DESKTOP WebRTC: ICE gathering already complete')
        resolve()
        return
      }

      // Set a timeout to prevent hanging forever
      const timeout = setTimeout(() => {
        console.log('🖥️ DESKTOP WebRTC: ICE gathering timeout - proceeding anyway')
        resolve()
      }, 5000) // 5 second timeout

      const checkState = () => {
        if (this.pc!.iceGatheringState === 'complete') {
          console.log('🖥️ DESKTOP WebRTC: ICE gathering completed')
          clearTimeout(timeout)
          resolve()
        } else {
          setTimeout(checkState, 100)
        }
      }

      checkState()
    })
  }

  getConnectionState(): string {
    return this.connectionState
  }

  disconnect() {
    console.log('🖥️ DESKTOP WebRTC: Disconnecting')

    if (this.dataChannel) {
      this.dataChannel.close()
      this.dataChannel = null
    }

    if (this.pc) {
      this.pc.close()
      this.pc = null
    }

    this.receivedData = ''
    this.connectionState = 'closed'
    this.events.onConnectionStateChange('closed')
  }
}