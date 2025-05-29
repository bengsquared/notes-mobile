"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Send, Download, Wifi, Shield, CheckCircle, XCircle, Loader2, Copy, Smartphone, Monitor } from "lucide-react"
import { getAllNotes, importNotes, type Note } from "@/lib/notes-storage"
import QRCodeGenerator from "@/components/qr-code"
import ExportNotes from "@/components/export-notes"

type TransferMode = "idle" | "sending" | "receiving" | "connecting"
type TransferStatus = "waiting" | "connected" | "transferring" | "completed" | "error"

interface TransferData {
  type: "notes-transfer"
  notes: Note[]
  totalSize: number
  deviceName: string
}

// Component for transferring to desktop
function TransferToDesktop() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'sending' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [transferInfo, setTransferInfo] = useState<{ count: number; size: string } | null>(null)

  // Calculate total size of notes data
  const calculateDesktopDataSize = (notes: any[]) => {
    const dataStr = JSON.stringify(notes)
    const bytes = new Blob([dataStr]).size
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const checkDesktopConnection = async () => {
    try {
      const response = await fetch('http://localhost:8080/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'ping', params: {}, id: 1 })
      })
      return response.ok
    } catch {
      return false
    }
  }

  const transferToDesktop = async () => {
    setStatus('checking')
    setError('')
    
    // Check if desktop app is running
    const isConnected = await checkDesktopConnection()
    if (!isConnected) {
      setStatus('error')
      setError('Desktop app not detected. Make sure Notes Desktop is running.')
      return
    }

    setStatus('sending')
    
    try {
      const webNotes = getAllNotes()
      
      // Convert web notes format to desktop format
      const notes = webNotes.map(note => ({
        id: note.id,
        content: note.text, // Map 'text' to 'content'
        createdAt: note.createdAt,
        updatedAt: note.createdAt, // Use createdAt as updatedAt since web doesn't track updates
        // Note: attachments and location are ignored for now in desktop
      }))
      
      const dataSize = calculateDesktopDataSize(notes)
      
      const response = await fetch('http://localhost:8080/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'transferNotes',
          params: { notes },
          id: Date.now()
        })
      })

      if (response.ok) {
        setStatus('success')
        setTransferInfo({ count: notes.length, size: dataSize })
      } else {
        throw new Error('Transfer failed')
      }
    } catch (err) {
      setStatus('error')
      setError('Failed to transfer notes. Please try again.')
      console.error('Transfer error:', err)
    }
  }

  const resetTransfer = () => {
    setStatus('idle')
    setError('')
    setTransferInfo(null)
  }

  if (status === 'idle') {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 p-3 rounded space-y-2 text-sm">
          <p className="font-medium">Requirements:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Notes Desktop app must be running</li>
            <li>Desktop app automatically listens on port 8080</li>
            <li>Both devices must be on the same network</li>
          </ul>
        </div>
        
        <Button onClick={transferToDesktop} className="w-full flex items-center gap-2">
          <Send className="w-4 h-4" />
          Transfer to Desktop
        </Button>
      </div>
    )
  }

  if (status === 'checking') {
    return (
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
        <p className="text-sm text-gray-600">Checking desktop connection...</p>
      </div>
    )
  }

  if (status === 'sending') {
    return (
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
        <p className="text-sm text-gray-600">Sending notes to desktop...</p>
      </div>
    )
  }

  if (status === 'success' && transferInfo) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
          <h3 className="font-medium text-green-700">Transfer Successful!</h3>
        </div>
        
        <div className="bg-green-50 p-3 rounded space-y-1">
          <p className="text-sm"><strong>Notes transferred:</strong> {transferInfo.count}</p>
          <p className="text-sm"><strong>Total size:</strong> {transferInfo.size}</p>
        </div>
        
        <Button variant="outline" onClick={resetTransfer} className="w-full">
          Transfer More Notes
        </Button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
        
        <div className="bg-yellow-50 p-3 rounded text-sm space-y-1">
          <p className="font-medium">Troubleshooting:</p>
          <ul className="list-disc list-inside text-gray-700">
            <li>Ensure Notes Desktop is running</li>
            <li>Check if both devices are on the same network</li>
            <li>Try restarting the desktop app</li>
          </ul>
        </div>
        
        <Button onClick={resetTransfer} className="w-full">
          Try Again
        </Button>
      </div>
    )
  }

  return null
}

export default function TransferNotes() {
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
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
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

  // Start sending mode
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

      channel.onclose = () => {
        console.log("Data channel closed")
      }

      dataChannel.current = channel

      // Create offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // In a real implementation, you'd send this offer through a signaling server
      // For demo purposes, we'll simulate the signaling
      console.log("Offer created, waiting for answer...")
    } catch (err) {
      setStatus("error")
      setError("Failed to start sending mode")
      console.error(err)
    }
  }

  // Start receiving mode
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

        channel.onclose = () => {
          console.log("Received data channel closed")
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

      // Update progress (simplified)
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
        deviceName: "Receiving Device",
        notesCount: notes.length,
        totalSize: calculateDataSize(notes),
      })
      setStatus("completed")
      setProgress(100)
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
    receivedData.current = ""
  }

  if (mode === "idle") {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              Transfer Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Transfer all your notes securely between devices using direct peer-to-peer connection.
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
              <span>Transfers are encrypted and direct between devices</span>
            </div>
          </CardContent>
        </Card>

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
              Send all your notes directly to the Notes Desktop app running on your computer.
            </p>
            
            <TransferToDesktop />
          </CardContent>
        </Card>

        {/* Export Notes Section */}
        <ExportNotes />
      </div>
    )
  }

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
                Scan the QR code or enter the connection code on the receiving device
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
              <Button onClick={() => (mode === "sending" ? startSending() : startReceiving())} className="flex-1">
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
