"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Send, Download, Wifi, Shield, CheckCircle, XCircle, Loader2, Copy, Smartphone, Monitor } from "lucide-react"
import { getAllNotes, importNotes, deleteAllNotes, type Note } from "@/lib/notes-storage"
import QRCodeGenerator from "@/components/qr-code"

type TransferMode = "idle" | "sending" | "receiving" | "desktop"
type TransferStatus = "waiting" | "connecting" | "connected" | "transferring" | "completed" | "error"

interface TransferData {
  type: "notes-transfer"
  notes: Note[]
  totalSize: number
  deviceName: string
}

export default function UnifiedTransfer() {
  const [mode, setMode] = useState<TransferMode>("idle")
  const [status, setStatus] = useState<TransferStatus>("waiting")
  const [connectionCode, setConnectionCode] = useState("")
  const [inputCode, setInputCode] = useState("")
  const [progress, setProgress] = useState(0)
  const [transferInfo, setTransferInfo] = useState<{
    deviceName: string
    notesCount: number
    totalSize: string
  } | null>(null)
  const [error, setError] = useState("")
  const [deleteAfterTransfer, setDeleteAfterTransfer] = useState(false)

  const peerConnection = useRef<RTCPeerConnection | null>(null)
  const dataChannel = useRef<RTCDataChannel | null>(null)
  const receivedData = useRef<string>("")

  // Generate a simple 6-digit connection code
  const generateConnectionCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  // Get device name (simplified)
  const getDeviceName = () => {
    const userAgent = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(userAgent)) return "iPhone"
    if (/Android/.test(userAgent)) return "Android"
    if (/Mac/.test(userAgent)) return "Mac"
    if (/Windows/.test(userAgent)) return "Windows"
    return "Device"
  }

  // Calculate total size of notes data
  const calculateDataSize = (notes: Note[]) => {
    const dataStr = JSON.stringify(notes)
    const bytes = new Blob([dataStr]).size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Initialize WebRTC connection
  const initializePeerConnection = () => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }, 
        { urls: "stun:stun1.l.google.com:19302" }
      ],
    })

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState)
      if (pc.iceConnectionState === "connected") {
        setStatus("connected")
      } else if (pc.iceConnectionState === "failed") {
        setStatus("error")
        setError("Connection failed. Please try again.")
      }
    }

    return pc
  }

  // Unified signaling function for desktop connections
  const sendSignalingMessage = async (message: any) => {
    const signalingPort = process.env.NODE_ENV === 'development' ? 8081 : 8080
    const signalingUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || `http://localhost:${signalingPort}/signal`
    
    const response = await fetch(signalingUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    })
    
    if (!response.ok) {
      throw new Error(`Signaling failed: ${response.statusText}`)
    }
    
    return await response.json()
  }

  // Start desktop transfer mode
  const startDesktopTransfer = async () => {
    setMode("desktop")
    setStatus("waiting")
    setError("")
  }

  // Connect to desktop using PIN
  const connectToDesktop = async () => {
    if (!inputCode || inputCode.length !== 6) {
      setError('Please enter a valid 6-character PIN')
      return
    }

    setStatus('connecting')
    setError('')

    try {
      // Initialize WebRTC connection
      const pc = initializePeerConnection()
      peerConnection.current = pc

      // Create data channel for sending
      const channel = pc.createDataChannel("notes-transfer", { ordered: true })
      dataChannel.current = channel

      channel.onopen = () => {
        console.log("Data channel opened for desktop transfer")
        setStatus("connected")
      }

      // Get connection code from desktop using PIN
      const codeResponse = await sendSignalingMessage({
        type: 'getConnectionCode',
        pin: inputCode
      })

      if (!codeResponse.success) {
        throw new Error('Invalid PIN or desktop not available')
      }

      const connectionCode = codeResponse.code

      // Create offer and send it to desktop
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const offerResponse = await sendSignalingMessage({
        type: 'offer',
        code: connectionCode,
        offer: offer
      })

      if (!offerResponse.success) {
        throw new Error('Failed to establish connection with desktop')
      }

      // Set remote description with desktop's answer
      await pc.setRemoteDescription(offerResponse.answer)

      // Handle ICE candidates
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            await sendSignalingMessage({
              type: 'iceCandidate',
              code: connectionCode,
              candidate: event.candidate
            })
          } catch (error) {
            console.error('Failed to send ICE candidate:', error)
          }
        }
      }

    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to connect to desktop')
      console.error(err)
    }
  }

  // Start sending mode (device-to-device)
  const startSending = async () => {
    try {
      setMode("sending")
      setStatus("waiting")
      setError("")

      const code = generateConnectionCode()
      setConnectionCode(code)

      const pc = initializePeerConnection()
      peerConnection.current = pc

      // Create data channel
      const channel = pc.createDataChannel("notes-transfer", {
        ordered: true,
      })

      channel.onopen = () => {
        console.log("Data channel opened")
        setStatus("connected")
      }

      dataChannel.current = channel

      // Create offer (would be sent through signaling server in full implementation)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      console.log("Offer created, waiting for answer...")
    } catch (err) {
      setStatus("error")
      setError("Failed to start sending mode")
      console.error(err)
    }
  }

  // Start receiving mode (device-to-device)
  const startReceiving = async () => {
    try {
      setMode("receiving")
      setStatus("waiting")
      setError("")

      const pc = initializePeerConnection()
      peerConnection.current = pc

      pc.ondatachannel = (event) => {
        const channel = event.channel
        dataChannel.current = channel

        channel.onopen = () => {
          console.log("Received data channel opened")
          setStatus("connected")
        }

        channel.onmessage = (event) => {
          handleReceivedData(event.data)
        }
      }
    } catch (err) {
      setStatus("error")
      setError("Failed to start receiving mode")
      console.error(err)
    }
  }

  // Handle received data
  const handleReceivedData = (data: string) => {
    try {
      if (data === "TRANSFER_START") {
        setStatus("transferring")
        setProgress(0)
        receivedData.current = ""
        return
      }

      if (data === "TRANSFER_END") {
        const transferData: TransferData = JSON.parse(receivedData.current)

        if (transferData.type === "notes-transfer") {
          importNotes(transferData.notes)
          setTransferInfo({
            deviceName: transferData.deviceName,
            notesCount: transferData.notes.length,
            totalSize: calculateDataSize(transferData.notes),
          })
          setStatus("completed")
          setProgress(100)
        }
        return
      }

      // Accumulate data chunks
      receivedData.current += data
      setProgress((prev) => Math.min(prev + 10, 90))
    } catch (err) {
      setStatus("error")
      setError("Failed to process received data")
      console.error(err)
    }
  }

  // Send notes data
  const sendNotes = async () => {
    if (!dataChannel.current || dataChannel.current.readyState !== "open") {
      setError("Connection not ready")
      return
    }

    try {
      setStatus("transferring")
      setProgress(0)

      const notes = getAllNotes()
      const transferData: TransferData = {
        type: "notes-transfer",
        notes,
        totalSize: new Blob([JSON.stringify(notes)]).size,
        deviceName: getDeviceName(),
      }

      const dataStr = JSON.stringify(transferData)

      // Send transfer start signal
      dataChannel.current.send("TRANSFER_START")

      // Send data in chunks (WebRTC has message size limits)
      const chunkSize = 16384 // 16KB chunks
      const chunks = Math.ceil(dataStr.length / chunkSize)

      for (let i = 0; i < chunks; i++) {
        const start = i * chunkSize
        const end = Math.min(start + chunkSize, dataStr.length)
        const chunk = dataStr.slice(start, end)

        dataChannel.current.send(chunk)
        setProgress(((i + 1) / chunks) * 90) // 90% for sending chunks

        // Small delay to prevent overwhelming
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Send transfer end signal
      dataChannel.current.send("TRANSFER_END")

      setTransferInfo({
        deviceName: mode === "desktop" ? "Desktop App" : "Receiving Device",
        notesCount: notes.length,
        totalSize: calculateDataSize(notes),
      })
      setStatus("completed")
      setProgress(100)

      // Delete notes if requested (desktop transfer only)
      if (mode === "desktop" && deleteAfterTransfer) {
        try {
          await deleteAllNotes()
        } catch (deleteError) {
          console.error('Error deleting notes after transfer:', deleteError)
          setError('Transfer successful, but failed to delete notes from this device.')
        }
      }
    } catch (err) {
      setStatus("error")
      setError("Failed to send notes")
      console.error(err)
    }
  }

  // Connect with code (simplified for demo)
  const connectWithCode = () => {
    if (inputCode.length === 6) {
      setStatus("connecting")
      // In real implementation, this would connect to the peer
      setTimeout(() => {
        setStatus("connected")
      }, 2000)
    }
  }

  // Copy connection code
  const copyConnectionCode = () => {
    navigator.clipboard.writeText(connectionCode)
  }

  // Reset transfer
  const resetTransfer = () => {
    if (peerConnection.current) {
      peerConnection.current.close()
      peerConnection.current = null
    }
    if (dataChannel.current) {
      dataChannel.current.close()
      dataChannel.current = null
    }

    setMode("idle")
    setStatus("waiting")
    setConnectionCode("")
    setInputCode("")
    setProgress(0)
    setTransferInfo(null)
    setError("")
    setDeleteAfterTransfer(false)
    receivedData.current = ""
  }

  if (mode === "idle") {
    return (
      <div className="space-y-4">
        {/* Desktop Transfer Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Transfer to Desktop App
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Send all your notes directly to the Notes Desktop app using secure WebRTC connection.
            </p>
            
            <div className="bg-blue-50 p-3 rounded space-y-2 text-sm">
              <p className="font-medium">How it works:</p>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Generate a PIN on your desktop app</li>
                <li>Enter the PIN here to establish secure connection</li>
                <li>Works across different networks (mobile data, WiFi)</li>
                <li>Direct peer-to-peer encrypted transfer</li>
              </ul>
            </div>
            
            <Button onClick={startDesktopTransfer} className="w-full flex items-center gap-2">
              <Send className="w-4 h-4" />
              Connect to Desktop
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              Device-to-Device Transfer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Transfer notes directly between devices using peer-to-peer WebRTC connection.
            </p>

            <div className="grid grid-cols-1 gap-3">
              <Button onClick={startSending} className="flex items-center gap-2 h-12">
                <Send className="w-4 h-4" />
                Send Notes to Another Device
              </Button>

              <Button variant="outline" onClick={startReceiving} className="flex items-center gap-2 h-12">
                <Download className="w-4 h-4" />
                Receive Notes from Another Device
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 p-3 rounded">
              <Shield className="w-4 h-4" />
              <span>All transfers are encrypted and direct between devices</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Desktop transfer mode
  if (mode === "desktop") {
    if (status === "waiting") {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Connect to Desktop
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <Shield className="w-12 h-12 mx-auto text-blue-500 mb-3" />
              <h3 className="font-medium">Enter Desktop PIN</h3>
              <p className="text-sm text-gray-600 mt-2">
                Generate a PIN on your desktop app and enter it here
              </p>
            </div>

            <div className="space-y-3">
              <Input
                type="text"
                placeholder="Enter 6-character PIN"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 6))}
                className="text-center text-lg font-mono"
                maxLength={6}
              />

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="delete-after-transfer"
                  checked={deleteAfterTransfer}
                  onCheckedChange={(checked) => setDeleteAfterTransfer(checked === true)}
                />
                <label 
                  htmlFor="delete-after-transfer" 
                  className="text-sm text-gray-600 cursor-pointer"
                >
                  Delete notes from this device after successful transfer
                </label>
              </div>

              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={connectToDesktop} 
                  disabled={inputCode.length !== 6}
                  className="flex-1"
                >
                  Connect
                </Button>
                <Button 
                  variant="outline" 
                  onClick={resetTransfer}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    if (status === "connecting") {
      return (
        <Card>
          <CardContent className="text-center space-y-3 pt-6">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
            <p className="text-sm text-gray-600">Connecting to desktop...</p>
          </CardContent>
        </Card>
      )
    }

    if (status === "connected") {
      return (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <h3 className="font-medium text-green-700">Connected to Desktop!</h3>
              <p className="text-sm text-gray-600 mt-2">
                Ready to transfer {getAllNotes().length} notes
              </p>
            </div>
            
            <Button onClick={sendNotes} className="w-full">
              Transfer Notes
            </Button>
          </CardContent>
        </Card>
      )
    }
  }

  // Rest of the component (device-to-device transfer states)
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {mode === "sending" ? <Send className="w-5 h-5" /> : <Download className="w-5 h-5" />}
            {mode === "sending" ? "Sending Notes" : "Receiving Notes"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {status === "waiting" && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            {status === "connected" && <CheckCircle className="w-4 h-4 text-green-500" />}
            {status === "transferring" && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            {status === "completed" && <CheckCircle className="w-4 h-4 text-green-500" />}
            {status === "error" && <XCircle className="w-4 h-4 text-red-500" />}

            <span className="text-sm font-medium">
              {status === "waiting" && "Waiting for connection..."}
              {status === "connected" && "Connected successfully"}
              {status === "transferring" && "Transferring data..."}
              {status === "completed" && "Transfer completed!"}
              {status === "error" && "Connection error"}
            </span>
          </div>

          {/* Sending Mode */}
          {mode === "sending" && status === "waiting" && (
            <div className="space-y-4">
              <div className="text-center space-y-3">
                <div className="bg-gray-100 p-4 rounded-lg">
                  <QRCodeGenerator value={connectionCode} size={150} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-600">Connection Code:</p>
                  <div className="flex items-center gap-2">
                    <Input value={connectionCode} readOnly className="text-center text-lg font-mono" />
                    <Button size="sm" variant="outline" onClick={copyConnectionCode}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600 text-center">
                Scan the QR code or enter this code in the receiving device
              </p>
            </div>
          )}

          {/* Receiving Mode */}
          {mode === "receiving" && status === "waiting" && (
            <div className="space-y-4">
              <div className="text-center">
                <Smartphone className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 mb-4">Enter the connection code from the sending device</p>
              </div>

              <div className="space-y-3">
                <Input
                  placeholder="Enter 6-digit code"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="text-center text-lg font-mono"
                  maxLength={6}
                />
                <Button onClick={connectWithCode} disabled={inputCode.length !== 6} className="w-full">
                  Connect
                </Button>
              </div>
            </div>
          )}

          {/* Connected - Ready to Transfer */}
          {status === "connected" && mode === "sending" && (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                <p className="text-sm text-gray-600">Device connected! Ready to send {getAllNotes().length} notes.</p>
              </div>
              <Button onClick={sendNotes} className="w-full">
                Start Transfer
              </Button>
            </div>
          )}

          {/* Transfer Progress */}
          {status === "transferring" && (
            <div className="space-y-3">
              <div className="text-center">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500 mb-2" />
                <p className="text-sm text-gray-600">
                  {mode === "sending" ? "Sending notes..." : "Receiving notes..."}
                </p>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-center text-gray-500">{progress.toFixed(0)}% complete</p>
            </div>
          )}

          {/* Transfer Completed */}
          {status === "completed" && transferInfo && (
            <div className="space-y-4">
              <div className="text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                <h3 className="font-medium text-green-700">Transfer Successful!</h3>
              </div>

              <div className="bg-green-50 p-3 rounded space-y-1">
                <p className="text-sm">
                  <strong>Device:</strong> {transferInfo.deviceName}
                </p>
                <p className="text-sm">
                  <strong>Notes:</strong> {transferInfo.notesCount}
                </p>
                <p className="text-sm">
                  <strong>Size:</strong> {transferInfo.totalSize}
                </p>
                {mode === "desktop" && deleteAfterTransfer && (
                  <p className="text-sm text-green-600"><strong>✓ Notes deleted from this device</strong></p>
                )}
              </div>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className="space-y-4">
              <div className="text-center">
                <XCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={resetTransfer} className="flex-1">
              {status === "completed" ? "Done" : "Cancel"}
            </Button>
            {status === "error" && (
              <Button onClick={() => mode === "sending" ? startSending() : startReceiving()} className="flex-1">
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}