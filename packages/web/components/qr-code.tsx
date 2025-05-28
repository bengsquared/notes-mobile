"use client"

import { useEffect, useRef } from "react"

interface QRCodeGeneratorProps {
  value: string
  size?: number
}

export default function QRCodeGenerator({ value, size = 200 }: QRCodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !value) return

    // Simple QR code placeholder - in a real app you'd use a QR library like 'qrcode'
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "white"
    ctx.fillRect(0, 0, size, size)

    // Draw a simple pattern as placeholder
    ctx.fillStyle = "black"
    const cellSize = size / 20

    // Create a simple pattern based on the value
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        const hash = value.charCodeAt((i + j) % value.length)
        if (hash % 3 === 0) {
          ctx.fillRect(i * cellSize, j * cellSize, cellSize, cellSize)
        }
      }
    }

    // Add corner markers
    const markerSize = cellSize * 3
    ctx.fillRect(0, 0, markerSize, markerSize)
    ctx.fillRect(size - markerSize, 0, markerSize, markerSize)
    ctx.fillRect(0, size - markerSize, markerSize, markerSize)
  }, [value, size])

  return (
    <div className="flex justify-center">
      <canvas ref={canvasRef} width={size} height={size} className="border border-gray-200 rounded" />
    </div>
  )
}
