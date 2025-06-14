/**
 * QR Code Generator for P2P Transfer Connection
 * 
 * Generates QR codes containing connection information for instant
 * mobile-to-desktop connection without network scanning.
 */

import QRCode from 'qrcode'

export interface ConnectionData {
  ip: string
  port: number
  pin: string
  version?: string
}

export interface QRCodeOptions {
  width?: number
  margin?: number
  color?: {
    dark?: string
    light?: string
  }
}

/**
 * Generate QR code as SVG string containing connection data
 */
export async function generateConnectionQR(
  connectionData: ConnectionData,
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 200,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  }

  const qrOptions = { ...defaultOptions, ...options }
  
  // Create connection URL that the web app can parse
  // In development, assume web app is running on localhost:3000
  // In production, use the actual deployed URL
  const connectionUrl = `http://localhost:3001/connect?ip=${connectionData.ip}&port=${connectionData.port}&pin=${connectionData.pin}&v=${connectionData.version || '1.0'}`
  
  try {
    const qrSvg = await QRCode.toString(connectionUrl, {
      type: 'svg',
      width: qrOptions.width,
      margin: qrOptions.margin,
      color: qrOptions.color
    })
    
    return qrSvg
  } catch (error) {
    console.error('QR code generation failed:', error)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Generate QR code as data URL (base64) for display in renderer
 */
export async function generateConnectionQRDataURL(
  connectionData: ConnectionData,
  options: QRCodeOptions = {}
): Promise<string> {
  const defaultOptions = {
    width: 200,
    margin: 2
  }

  const qrOptions = { ...defaultOptions, ...options }
  
  const connectionUrl = `http://localhost:3001/connect?ip=${connectionData.ip}&port=${connectionData.port}&pin=${connectionData.pin}&v=${connectionData.version || '1.0'}`
  
  try {
    const qrDataURL = await QRCode.toDataURL(connectionUrl, {
      width: qrOptions.width,
      margin: qrOptions.margin,
      color: qrOptions.color
    })
    
    return qrDataURL
  } catch (error) {
    console.error('QR code generation failed:', error)
    throw new Error('Failed to generate QR code')
  }
}

/**
 * Get local IP addresses for QR code generation
 */
export function getLocalIPAddresses(): string[] {
  const { networkInterfaces } = require('os')
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