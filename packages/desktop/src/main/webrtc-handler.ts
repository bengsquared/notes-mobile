export class WebRTCHandler {
  private connections = new Map<string, RTCPeerConnection>()
  private pendingCodes = new Map<string, any>()
  
  constructor(private onNotesReceived: (notes: any[]) => void) {}

  // Generate a connection code for pairing
  generateConnectionCode(): string {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    // Create peer connection for this code
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    })
    
    // Handle incoming data channel
    pc.ondatachannel = (event) => {
      const channel = event.channel
      let receivedData = ""
      
      channel.onmessage = (event) => {
        const data = event.data
        
        if (data === "TRANSFER_START") {
          receivedData = ""
          return
        }
        
        if (data === "TRANSFER_END") {
          try {
            const transferData = JSON.parse(receivedData)
            if (transferData.type === "notes-transfer") {
              this.onNotesReceived(transferData.notes)
            }
          } catch (error) {
            console.error("Error processing received notes:", error)
          }
          return
        }
        
        // Accumulate data chunks
        receivedData += data
      }
      
      channel.onopen = () => {
        console.log("Data channel opened for receiving")
      }
    }
    
    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState)
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
        this.connections.delete(code)
      }
    }
    
    this.connections.set(code, pc)
    
    // Set expiry for the code (5 minutes)
    setTimeout(() => {
      if (this.connections.has(code)) {
        this.connections.get(code)?.close()
        this.connections.delete(code)
        this.pendingCodes.delete(code)
      }
    }, 5 * 60 * 1000)
    
    return code
  }

  // Handle offer from web app
  async handleOffer(code: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit | null> {
    const pc = this.connections.get(code)
    if (!pc) {
      return null
    }
    
    try {
      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      return answer
    } catch (error) {
      console.error("Error handling offer:", error)
      return null
    }
  }

  // Handle ICE candidate from web app
  async handleIceCandidate(code: string, candidate: RTCIceCandidateInit) {
    const pc = this.connections.get(code)
    if (pc) {
      try {
        await pc.addIceCandidate(candidate)
      } catch (error) {
        console.error("Error adding ICE candidate:", error)
      }
    }
  }

  // Clean up connections
  cleanup() {
    for (const pc of this.connections.values()) {
      pc.close()
    }
    this.connections.clear()
    this.pendingCodes.clear()
  }
}