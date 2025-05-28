"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Download, FileText, Loader2, CheckCircle, FolderOpen } from "lucide-react"
import { getAllNotes, type Note } from "@/lib/notes-storage"

export default function ExportNotes() {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [exportComplete, setExportComplete] = useState(false)

  // Sanitize filename to be safe for file systems
  const sanitizeFilename = (text: string): string => {
    return text
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "") // Remove invalid characters
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .trim()
  }

  // Generate filename from note content and date
  const generateFilename = (note: Note): string => {
    const textPreview = note.text.slice(0, 30).trim() || "note"
    const date = new Date(note.createdAt)
    const dateStr = date.toISOString().split("T")[0] // YYYY-MM-DD format
    const timeStr = date.toTimeString().split(" ")[0].replace(/:/g, "-") // HH-MM-SS

    return sanitizeFilename(`${textPreview}_${dateStr}_${timeStr}`)
  }

  // Handle filename collisions by adding numbers
  const getUniqueFilename = (baseFilename: string, extension: string, usedFilenames: Set<string>): string => {
    let filename = `${baseFilename}${extension}`
    let counter = 1

    while (usedFilenames.has(filename)) {
      filename = `${baseFilename}_${counter}${extension}`
      counter++
    }

    usedFilenames.add(filename)
    return filename
  }

  // Convert base64 to blob
  const base64ToBlob = (base64: string): Blob => {
    const parts = base64.split(",")
    const contentType = parts[0].match(/:(.*?);/)?.[1] || ""
    const raw = atob(parts[1])
    const rawLength = raw.length
    const uInt8Array = new Uint8Array(rawLength)

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i)
    }

    return new Blob([uInt8Array], { type: contentType })
  }

  // Get file extension from attachment type
  const getFileExtension = (attachment: Note["attachments"][0]): string => {
    switch (attachment.type) {
      case "photo":
        return ".jpg"
      case "video":
        return ".mp4"
      case "audio":
        return ".webm"
      default:
        return ".bin"
    }
  }

  // Generate text content for note
  const generateNoteText = (note: Note): string => {
    let content = note.text || "(No text content)"

    // Add metadata section
    content += "\n\n" + "=".repeat(50) + "\n"
    content += "NOTE METADATA\n"
    content += "=".repeat(50) + "\n"

    // Add creation date
    const date = new Date(note.createdAt)
    content += `Created: ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}\n`

    // Add location if available
    if (note.location) {
      content += `Location: ${note.location.lat.toFixed(6)}, ${note.location.lng.toFixed(6)}\n`
      content += `Google Maps: https://maps.google.com/?q=${note.location.lat},${note.location.lng}\n`
    } else {
      content += "Location: Not captured\n"
    }

    // Add attachments info
    if (note.attachments.length > 0) {
      content += `\nAttachments (${note.attachments.length}):\n`
      note.attachments.forEach((attachment, index) => {
        content += `- ${attachment.type} file: ${attachment.name}\n`
      })
    } else {
      content += "\nAttachments: None\n"
    }

    return content
  }

  // Export all notes
  const exportNotes = async () => {
    setIsExporting(true)
    setProgress(0)
    setExportComplete(false)

    try {
      const notes = getAllNotes()

      if (notes.length === 0) {
        alert("No notes to export!")
        setIsExporting(false)
        return
      }

      // Dynamic import of JSZip
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()

      const usedFilenames = new Set<string>()
      let processedNotes = 0

      for (const note of notes) {
        const baseFilename = generateFilename(note)

        // Create text file
        const textContent = generateNoteText(note)
        const textFilename = getUniqueFilename(baseFilename, ".txt", usedFilenames)
        zip.file(textFilename, textContent)

        // Add media attachments
        note.attachments.forEach((attachment, index) => {
          const extension = getFileExtension(attachment)
          const mediaFilename = getUniqueFilename(
            `${baseFilename}_${attachment.type}_${index + 1}`,
            extension,
            usedFilenames,
          )

          try {
            const blob = base64ToBlob(attachment.data)
            zip.file(mediaFilename, blob)
          } catch (error) {
            console.error(`Failed to process attachment ${attachment.name}:`, error)
          }
        })

        processedNotes++
        setProgress((processedNotes / notes.length) * 90) // 90% for processing notes
      }

      setProgress(95)

      // Generate and download ZIP file
      const zipBlob = await zip.generateAsync({ type: "blob" })
      setProgress(100)

      // Create download link
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement("a")
      link.href = url
      link.download = `notes_export_${new Date().toISOString().split("T")[0]}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportComplete(true)
    } catch (error) {
      console.error("Export failed:", error)
      alert("Export failed. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  const resetExport = () => {
    setProgress(0)
    setExportComplete(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          Export Notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Download all your notes as organized text files with media attachments in a ZIP archive.
        </p>

        <div className="bg-blue-50 p-3 rounded space-y-1 text-sm">
          <p className="font-medium">Export includes:</p>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Individual .txt files for each note</li>
            <li>Location data and Google Maps links</li>
            <li>All photos, videos, and audio recordings</li>
            <li>Export summary with statistics</li>
          </ul>
        </div>

        {!isExporting && !exportComplete && (
          <Button onClick={exportNotes} className="w-full flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export All Notes ({getAllNotes().length} notes)
          </Button>
        )}

        {isExporting && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium">Preparing export...</span>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-xs text-center text-gray-500">{progress.toFixed(0)}% complete</p>
          </div>
        )}

        {exportComplete && (
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
              <h3 className="font-medium text-green-700">Export Complete!</h3>
              <p className="text-sm text-gray-600">Your notes have been downloaded as a ZIP file.</p>
            </div>

            <Button variant="outline" onClick={resetExport} className="w-full">
              Export Again
            </Button>
          </div>
        )}

        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <FileText className="w-3 h-3 inline mr-1" />
          Files are named using the first 30 characters of each note plus the creation date.
        </div>
      </CardContent>
    </Card>
  )
}
