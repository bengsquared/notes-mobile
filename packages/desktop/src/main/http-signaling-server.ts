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
import { Server as HTTPSServer } from 'https'
import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'

interface PendingConnection {
  pin: string
  offer?: string
  answer?: string
  timestamp: number
}

export class HTTPSignalingServer {
  private app: express.Application
  private server: Server | HTTPSServer | null = null
  private port: number = 8080
  private connections = new Map<string, PendingConnection>()
  private window: BrowserWindow | null = null
  private requestCount: number = 0
  private lastRequestTime: number = 0
  private useHTTPS: boolean = false
  private certPath: string = ''
  private keyPath: string = ''
  
  constructor(window: BrowserWindow) {
    this.window = window
    this.app = express()
    this.setupCertificates()
    this.setupMiddleware()
    this.setupRoutes()
    this.startCleanupInterval()
  }

  private setupCertificates() {
    const userDataPath = app.getPath('userData')
    const certDir = path.join(userDataPath, 'certificates')
    this.certPath = path.join(certDir, 'server.crt')
    this.keyPath = path.join(certDir, 'server.key')

    // Check if certificates exist
    if (fs.existsSync(this.certPath) && fs.existsSync(this.keyPath)) {
      this.useHTTPS = true
      console.log('📜 Found existing SSL certificates, enabling HTTPS')
    } else {
      // Generate self-signed certificates
      this.generateSelfSignedCertificates(certDir)
    }
  }

  private generateSelfSignedCertificates(certDir: string) {
    try {
      // Create certificates directory
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true })
      }

      // Use selfsigned package to generate proper certificates
      const selfsigned = require('selfsigned')
      
      // Get local IP addresses for certificate
      const localIPs = this.getLocalAddresses()
      
      const attrs = [
        { name: 'commonName', value: 'Notes Desktop App' },
        { name: 'countryName', value: 'US' },
        { name: 'stateOrProvinceName', value: 'CA' },
        { name: 'localityName', value: 'San Francisco' },
        { name: 'organizationName', value: 'Notes App' },
        { name: 'organizationalUnitName', value: 'Development' }
      ]

      const options = {
        keySize: 2048,
        days: 365,
        algorithm: 'sha256',
        extensions: [
          {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
          },
          {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            timeStamping: true
          },
          {
            name: 'subjectAltName',
            altNames: [
              { type: 2, value: 'localhost' },
              { type: 7, ip: '127.0.0.1' },
              { type: 7, ip: '::1' },
              ...localIPs.map(ip => ({ type: 7, ip }))
            ]
          }
        ]
      }

      const pems = selfsigned.generate(attrs, options)
      
      fs.writeFileSync(this.keyPath, pems.private)
      fs.writeFileSync(this.certPath, pems.cert)
      
      this.useHTTPS = true
      console.log('📜 Generated self-signed SSL certificates with local IP support, enabling HTTPS')
      console.log('📜 Certificate valid for IPs:', ['127.0.0.1', '::1', ...localIPs])
    } catch (error) {
      console.error('❌ Failed to generate SSL certificates, falling back to HTTP:', error)
      this.useHTTPS = false
    }
  }

  private setupMiddleware() {
    this.app.use(cors({
      origin: true, // Allow all origins for local development
      credentials: true
    }))
    this.app.use(express.json({ limit: '10mb' }))
    
    // Comprehensive request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      this.requestCount++
      this.lastRequestTime = Date.now()
      
      const timestamp = new Date().toISOString()
      console.log(`\n📡 [${timestamp}] HTTP Signaling Server - Incoming Request #${this.requestCount}:`)
      console.log(`   Method: ${req.method}`)
      console.log(`   Path: ${req.path}`)
      console.log(`   Full URL: ${req.url}`)
      console.log(`   Headers:`, JSON.stringify(req.headers, null, 2))
      
      if (req.body && Object.keys(req.body).length > 0) {
        console.log(`   Body:`, JSON.stringify(req.body, null, 2))
      } else {
        console.log(`   Body: (empty)`)
      }
      
      console.log(`   Client IP: ${req.ip}`)
      console.log(`   User-Agent: ${req.get('User-Agent')}`)
      
      // Log response when it's sent
      const originalSend = res.send
      res.send = function(data) {
        console.log(`📡 [${timestamp}] Response sent:`)
        console.log(`   Status: ${res.statusCode}`)
        console.log(`   Data:`, typeof data === 'string' ? data : JSON.stringify(data, null, 2))
        console.log(`📡 [${timestamp}] Request #${this.requestCount} completed\n`)
        return originalSend.call(this, data)
      }
      
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
      const timestamp = new Date().toISOString()

      console.log(`\n🎯 [${timestamp}] /signal/:pin endpoint hit!`)
      console.log(`   PIN: ${pin}`)
      console.log(`   Signal Type: ${type}`)
      console.log(`   Data length: ${data ? (typeof data === 'string' ? data.length : JSON.stringify(data).length) : 0} characters`)
      console.log(`   Current active connections: ${this.connections.size}`)
      console.log(`   Connection PINs: [${Array.from(this.connections.keys()).join(', ')}]`)

      if (type === 'offer') {
        console.log(`🎯 Processing OFFER for PIN ${pin}`)
        
        // Store the offer
        const connection: PendingConnection = this.connections.get(pin) || {
          pin,
          timestamp: Date.now()
        }
        connection.offer = data
        this.connections.set(pin, connection)

        console.log(`✅ Stored offer for PIN ${pin}`)
        console.log(`   Connection object:`, JSON.stringify(connection, null, 2))
        console.log(`   Total connections after storing: ${this.connections.size}`)
        
        // Notify desktop app that offer is available
        if (this.window?.webContents) {
          console.log(`📤 Sending IPC event 'webrtc-offer-received' to renderer process`)
          console.log(`   Event data: { pin: "${pin}", offer: ${data ? 'present' : 'null'} }`)
          this.window.webContents.send('webrtc-offer-received', { pin, offer: data })
          console.log(`✅ IPC event sent successfully`)
        } else {
          console.error(`❌ Cannot send IPC event - window or webContents is null`)
          console.log(`   Window exists: ${!!this.window}`)
          console.log(`   WebContents exists: ${!!this.window?.webContents}`)
        }
        
        res.json({ status: 'offer-received', message: 'Waiting for desktop to process offer' })
      } 
      else if (type === 'answer-request') {
        console.log(`🎯 Processing ANSWER-REQUEST for PIN ${pin}`)
        
        // Mobile is requesting the answer
        const connection = this.connections.get(pin)
        console.log(`   Connection found: ${!!connection}`)
        console.log(`   Answer ready: ${!!connection?.answer}`)
        
        if (connection?.answer) {
          console.log(`✅ Sending answer for PIN ${pin}`)
          console.log(`   Answer data: ${connection.answer ? 'present' : 'null'}`)
          res.json({ type: 'answer', data: connection.answer })
          
          // Clean up after successful exchange
          console.log(`🧹 Cleaning up connection for PIN ${pin}`)
          this.connections.delete(pin)
          console.log(`   Remaining connections: ${this.connections.size}`)
        } else {
          console.log(`⏳ Answer not ready for PIN ${pin}, sending 202 status`)
          res.status(202).json({ status: 'waiting', message: 'Answer not ready yet' })
        }
      }
      else {
        console.error(`❌ Unknown signal type: "${type}" for PIN ${pin}`)
        res.status(400).json({ error: 'Unknown signal type' })
      }
      
      console.log(`🎯 /signal/:pin processing completed for PIN ${pin}\n`)
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
    const originalPort = this.port
    const protocol = this.useHTTPS ? 'HTTPS' : 'HTTP'
    console.log(`\n🚀 Starting ${protocol} Signaling Server...`)
    console.log(`   Initial port: ${originalPort}`)
    console.log(`   Using HTTPS: ${this.useHTTPS}`)
    
    return new Promise((resolve, reject) => {
      if (this.useHTTPS) {
        // Create HTTPS server
        const httpsOptions = {
          key: fs.readFileSync(this.keyPath),
          cert: fs.readFileSync(this.certPath)
        }
        this.server = new HTTPSServer(httpsOptions, this.app)
      } else {
        // Create HTTP server
        this.server = new Server(this.app)
      }

      this.server.listen(this.port, '0.0.0.0', () => {
        const addresses = this.getLocalAddresses()
        const timestamp = new Date().toISOString()
        
        console.log(`\n✅ [${timestamp}] ${protocol} Signaling Server STARTED SUCCESSFULLY!`)
        console.log(`   Requested port: ${originalPort}`)
        console.log(`   Actual port: ${this.port}`)
        console.log(`   Port changed: ${this.port !== originalPort ? 'YES' : 'NO'}`)
        console.log(`   Protocol: ${protocol}`)
        console.log(`   Listening on: 0.0.0.0:${this.port}`)
        console.log(`   📡 Server accessible at:`)
        addresses.forEach(addr => {
          const url = this.useHTTPS ? `https://${addr}:${this.port}` : `http://${addr}:${this.port}`
          console.log(`      ${url}`)
        })
        const protocolPrefix = this.useHTTPS ? 'https' : 'http'
        console.log(`   🔍 Mobile devices should connect to: ${protocolPrefix}://[YOUR_IP]:${this.port}`)
        console.log(`   ⚠️  PORT MISMATCH ALERT: If mobile is trying port ${originalPort} but server is on ${this.port}, connections will FAIL!`)
        if (this.useHTTPS) {
          console.log(`   🔒 HTTPS enabled - mixed content errors should be resolved`)
        }
        
        // Notify renderer about server status
        if (this.window?.webContents) {
          console.log(`📤 Sending 'http-signaling-started' IPC event to renderer`)
          this.window.webContents.send('http-signaling-started', {
            port: this.port,
            originalPort,
            addresses,
            portChanged: this.port !== originalPort
          })
          console.log(`✅ IPC event sent successfully`)
        } else {
          console.error(`❌ Cannot send IPC event - window or webContents is null`)
        }
        
        console.log(`🎯 Server is now ready to receive requests!\n`)
        resolve()
      })
      
      this.server.on('error', (error: any) => {
        console.error(`❌ Server error on port ${this.port}:`, error)
        if (error.code === 'EADDRINUSE') {
          console.log(`📡 Port ${this.port} is in use, incrementing to ${this.port + 1}`)
          this.port++
          console.log(`🔄 Retrying server start with new port: ${this.port}`)
          this.start().then(resolve).catch(reject)
        } else {
          console.error(`💥 Fatal server error:`, error)
          reject(error)
        }
      })
      
      // Add connection event logging
      this.server.on('connection', (socket) => {
        console.log(`🔌 New TCP connection established from ${socket.remoteAddress}:${socket.remotePort}`)
        
        socket.on('close', () => {
          console.log(`🔌 TCP connection closed from ${socket.remoteAddress}:${socket.remotePort}`)
        })
        
        socket.on('error', (err: Error) => {
          console.error(`🔌 TCP connection error from ${socket.remoteAddress}:${socket.remotePort}:`, err)
        })
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