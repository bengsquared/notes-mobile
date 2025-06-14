interface QRCodeData {
  ip: string
  port: number
  pin: string
  v?: string
}

export function parseConnectionQR(qrData: string): QRCodeData | null {
  try {
    const url = new URL(qrData)
    
    // Handle both new custom protocol and legacy HTTP URLs
    if (url.protocol === 'notes-transfer:' || (url.protocol.startsWith('http') && url.pathname === '/connect')) {
      const ip = url.searchParams.get('ip')
      const port = url.searchParams.get('port')
      const pin = url.searchParams.get('pin')
      const version = url.searchParams.get('v')
      
      if (ip && port && pin) {
        return {
          ip,
          port: parseInt(port),
          pin,
          v: version || '1.0'
        }
      }
    }
    
    return null
  } catch (error) {
    return null
  }
}