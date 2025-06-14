/**
 * Simple HTTP Signaling Server for WebRTC P2P Transfer
 * 
 * This runs in the Electron main process and provides HTTP endpoints
 * for WebRTC signaling between mobile web and desktop.
 */

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { BrowserWindow } from 'electron'
import { networkInterfaces } from 'os'
import { Server } from 'http'

interface PendingConnection {
  pin: string
  offer?: string
  answer?: string
  timestamp: number
}

export class HTTPSignalingServer {
  private app: express.Application
  private server: Server | null = null
  private port: number = 8080
  private connections = new Map<string, PendingConnection>()
  private window: BrowserWindow | null = null
  
  constructor(window: BrowserWindow) {
    this.window = window
    this.app = express()
    this.setupMiddleware()
    this.setupRoutes()
    this.startCleanupInterval()
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: true, // Allow all origins for local development
      credentials: true
    }))
    this.app.use(express.json({ limit: '10mb' }))
    
    // Log all requests
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`📡 HTTP Signaling: ${req.method} ${req.path}`)
      next()
    })
  }

  private setupRoutes() {
    // Health check / discovery endpoint
    this.app.get('/discover', (_req: Request, res: Response) => {
      res.json({
        status: 'available',
        name: 'Notes Desktop App',
        version: '1.0.0',
        capabilities: ['webrtc-transfer']
      })
    })

    // Mobile sends offer with PIN
    this.app.post('/signal/:pin', (req: Request, res: Response) => {
      const pin = req.params.pin
      const { type, data } = req.body

      console.log(`📡 HTTP Signaling: Received ${type} for PIN ${pin}`)

      if (type === 'offer') {
        // Store the offer
        const connection: PendingConnection = this.connections.get(pin) || {
          pin,
          timestamp: Date.now()
        }
        connection.offer = data
        this.connections.set(pin, connection)

        console.log(`📡 HTTP Signaling: Stored offer for PIN ${pin}`)
        
        // Notify desktop app that offer is available
        this.window?.webContents.send('webrtc-offer-received', { pin, offer: data })
        
        res.json({ status: 'offer-received', message: 'Waiting for desktop to process offer' })
      } 
      else if (type === 'answer-request') {
        // Mobile is requesting the answer
        const connection = this.connections.get(pin)
        
        if (connection?.answer) {
          console.log(`📡 HTTP Signaling: Sending answer for PIN ${pin}`)
          res.json({ type: 'answer', data: connection.answer })
          
          // Clean up after successful exchange
          this.connections.delete(pin)
        } else {
          res.status(202).json({ status: 'waiting', message: 'Answer not ready yet' })
        }
      }
      else {
        res.status(400).json({ error: 'Unknown signal type' })
      }
    })

    // Desktop sends answer for PIN
    this.app.post('/answer/:pin', (req: Request, res: Response) => {
      const pin = req.params.pin
      const { answer } = req.body

      console.log(`📡 HTTP Signaling: Received answer for PIN ${pin}`)
      
      const connection = this.connections.get(pin)
      if (connection) {
        connection.answer = answer
        this.connections.set(pin, connection)
        
        console.log(`📡 HTTP Signaling: Stored answer for PIN ${pin}`)
        res.json({ status: 'answer-stored' })
      } else {
        res.status(404).json({ error: 'PIN not found or expired' })
      }
    })

    // Get local IP addresses
    this.app.get('/network-info', (_req: Request, res: Response) => {
      const interfaces = networkInterfaces()
      const addresses: string[] = []
      
      for (const interfaceName of Object.keys(interfaces)) {
        const nets = interfaces[interfaceName] || []
        for (const net of nets) {
          if (net.family === 'IPv4' && !net.internal) {
            addresses.push(net.address)
          }
        }
      }
      
      res.json({ 
        addresses,
        port: this.port,
        status: 'running'
      })
    })
  }

  private startCleanupInterval() {
    // Clean up expired connections every minute
    setInterval(() => {
      const now = Date.now()
      const expiredPins: string[] = []
      
      for (const [pin, connection] of this.connections.entries()) {
        // Expire after 5 minutes
        if (now - connection.timestamp > 5 * 60 * 1000) {
          expiredPins.push(pin)
        }
      }
      
      for (const pin of expiredPins) {
        console.log(`📡 HTTP Signaling: Expired PIN ${pin}`)
        this.connections.delete(pin)
      }
    }, 60000) // Check every minute
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, '0.0.0.0', () => {
        const addresses = this.getLocalAddresses()
        console.log(`📡 HTTP Signaling Server started on port ${this.port}`)
        console.log(`📡 Available at:`)
        addresses.forEach(addr => {
          console.log(`   http://${addr}:${this.port}`)
        })
        
        // Notify renderer about server status
        this.window?.webContents.send('http-signaling-started', {
          port: this.port,
          addresses
        })
        
        resolve()
      })
      
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          console.log(`📡 Port ${this.port} in use, trying ${this.port + 1}`)
          this.port++
          this.start().then(resolve).catch(reject)
        } else {
          reject(error)
        }
      })
    })
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      console.log('📡 HTTP Signaling Server stopped')
    }
  }

  private getLocalAddresses(): string[] {
    const interfaces = networkInterfaces()
    const addresses: string[] = []
    
    for (const interfaceName of Object.keys(interfaces)) {
      const nets = interfaces[interfaceName] || []
      for (const net of nets) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address)
        }
      }
    }
    
    return addresses
  }

  // Method for desktop to submit answer
  submitAnswer(pin: string, answer: string): boolean {
    const connection = this.connections.get(pin)
    if (connection) {
      connection.answer = answer
      this.connections.set(pin, connection)
      console.log(`📡 HTTP Signaling: Desktop submitted answer for PIN ${pin}`)
      return true
    }
    return false
  }

  // Get pending offer for PIN
  getPendingOffer(pin: string): string | null {
    const connection = this.connections.get(pin)
    return connection?.offer || null
  }
}