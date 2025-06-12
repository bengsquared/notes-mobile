"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Camera, Video, Mic, Save, MapPin, MapPinOff, AlertCircle } from "lucide-react"
import { saveNote, type Note, updateNote } from "@/lib/notes-storage"

interface ComposeNoteProps {
  onNoteCreated: () => void
  editingNote?: Note | null
  onEditComplete?: () => void
}

type LocationState = "unknown" | "requesting" | "granted" | "denied" | "unavailable"

export default function ComposeNote({ onNoteCreated, editingNote, onEditComplete }: ComposeNoteProps) {
  const [text, setText] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationState, setLocationState] = useState<LocationState>("unknown")
  const [attachments, setAttachments] = useState<
    Array<{ type: "photo" | "video" | "audio"; data: string; name: string }>
  >([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Check if geolocation is available
    if (!navigator.geolocation) {
      setLocationState("unavailable")
      return
    }

    // Try to get location automatically on first load (only for new notes)
    if (!editingNote) {
      requestLocation()
    }
  }, [])

  useEffect(() => {
    if (editingNote) {
      setText(editingNote.text)
      setAttachments(editingNote.attachments)
      setLocation(editingNote.location || null)
      // Don't auto-request location when editing
      if (editingNote.location) {
        setLocationState("granted")
      }
    }
  }, [editingNote])

  // Auto-save on unmount if changes exist
  useEffect(() => {
    return () => {
      if (editingNote && text.trim() && (text !== editingNote.text || attachments.length !== editingNote.attachments.length)) {
        const updatedNote: Note = {
          ...editingNote,
          text: text.trim(),
          attachments,
          location,
        }
        updateNote(updatedNote)
      }
    }
  }, []) // Only on unmount

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState("unavailable")
      return
    }

    setLocationState("requesting")

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationState("granted")
      },
      (error) => {
        console.log("Location error:", error.message)
        setLocationState("denied")
        // Don't set location to null here - keep existing location if editing
        if (!editingNote) {
          setLocation(null)
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 300000, // 5 minutes
      },
    )
  }

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setAttachments((prev) => [
          ...prev,
          {
            type: "photo",
            data: result,
            name: file.name,
          },
        ])
      }
      reader.readAsDataURL(file)
    }
  }

  const handleVideoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        setAttachments((prev) => [
          ...prev,
          {
            type: "video",
            data: result,
            name: file.name,
          },
        ])
      }
      reader.readAsDataURL(file)
    }
  }

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (event) => {
        chunks.push(event.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" })
        const reader = new FileReader()
        reader.onload = (e) => {
          const result = e.target?.result as string
          setAttachments((prev) => [
            ...prev,
            {
              type: "audio",
              data: result,
              name: `audio-${Date.now()}.webm`,
            },
          ])
        }
        reader.readAsDataURL(blob)
        stream.getTracks().forEach((track) => track.stop())
      }

      setMediaRecorder(recorder)
      recorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error("Error starting audio recording:", error)
    }
  }

  const stopAudioRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop()
      setMediaRecorder(null)
      setIsRecording(false)
    }
  }

  const handleSave = () => {
    if (!text.trim() && attachments.length === 0) return

    if (editingNote) {
      // Update existing note
      const updatedNote: Note = {
        ...editingNote,
        text: text.trim(),
        attachments,
        location,
      }
      updateNote(updatedNote)
      onEditComplete?.()
    } else {
      // Create new note
      const note: Omit<Note, "id"> = {
        text: text.trim(),
        attachments,
        location,
        createdAt: new Date().toISOString(),
      }
      saveNote(note)
      onNoteCreated()
    }

    // Reset form
    setText("")
    setAttachments([])
    setLocation(null)
    setLocationState("unknown")
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const getLocationButton = () => {
    switch (locationState) {
      case "requesting":
        return (
          <Button variant="outline" size="sm" disabled className="flex items-center gap-1">
            <MapPin className="w-4 h-4 animate-pulse" />
            Getting location...
          </Button>
        )
      case "granted":
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={requestLocation}
            className="flex items-center gap-1 bg-green-50 text-green-700 border-green-200"
          >
            <MapPin className="w-4 h-4" />
            Update location
          </Button>
        )
      case "denied":
        return (
          <Button
            variant="outline"
            size="sm"
            onClick={requestLocation}
            className="flex items-center gap-1 bg-orange-50 text-orange-700 border-orange-200"
          >
            <MapPinOff className="w-4 h-4" />
            Try location again
          </Button>
        )
      case "unavailable":
        return (
          <Button variant="outline" size="sm" disabled className="flex items-center gap-1 bg-gray-50 text-gray-500">
            <AlertCircle className="w-4 h-4" />
            Location unavailable
          </Button>
        )
      default:
        return (
          <Button variant="outline" size="sm" onClick={requestLocation} className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            Add location
          </Button>
        )
    }
  }

  const getLocationMessage = () => {
    switch (locationState) {
      case "requesting":
        return (
          <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded flex items-center gap-2">
            <MapPin className="w-4 h-4 animate-pulse" />
            <span>Requesting your location...</span>
          </div>
        )
      case "granted":
        return location ? (
          <div className="text-sm text-green-600 bg-green-50 p-2 rounded flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>
              Location captured: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </span>
          </div>
        ) : null
      case "denied":
        return (
          <div className="text-sm text-orange-600 bg-orange-50 p-2 rounded flex items-center gap-2">
            <MapPinOff className="w-4 h-4" />
            <span>Location access denied. You can try again or save without location.</span>
          </div>
        )
      case "unavailable":
        return (
          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>Location services are not available on this device.</span>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <Textarea
            placeholder="What's on your mind?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-32 resize-none border-0 p-0 text-base focus-visible:ring-0"
          />

          {/* Media Controls */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1"
            >
              <Camera className="w-4 h-4" />
              Photo
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => videoInputRef.current?.click()}
              className="flex items-center gap-1"
            >
              <Video className="w-4 h-4" />
              Video
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={isRecording ? stopAudioRecording : startAudioRecording}
              className={`flex items-center gap-1 ${isRecording ? "bg-red-100 text-red-700" : ""}`}
            >
              <Mic className="w-4 h-4" />
              {isRecording ? "Stop" : "Audio"}
            </Button>

            {getLocationButton()}
          </div>

          {/* Location Status Message */}
          {getLocationMessage()}

          {/* Attachments Preview */}
          {attachments.length > 0 && (
            <div className="space-y-2">
              {attachments.map((attachment, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <div className="flex items-center gap-2">
                    {attachment.type === "photo" && (
                      <>
                        <Camera className="w-4 h-4" />
                        <img
                          src={attachment.data || "/placeholder.svg"}
                          alt="Preview"
                          className="w-8 h-8 object-cover rounded"
                        />
                        <span className="text-sm">Photo</span>
                      </>
                    )}
                    {attachment.type === "video" && (
                      <>
                        <Video className="w-4 h-4" />
                        <video src={attachment.data} className="w-8 h-8 object-cover rounded" />
                        <span className="text-sm">Video</span>
                      </>
                    )}
                    {attachment.type === "audio" && (
                      <>
                        <Mic className="w-4 h-4" />
                        <span className="text-sm">Audio Recording</span>
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAttachment(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={!text.trim() && attachments.length === 0}
            className="w-full flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {editingNote ? "Update Note" : "Save Note"}
          </Button>
          {editingNote && (
            <Button
              variant="outline"
              onClick={() => {
                setText("")
                setAttachments([])
                setLocation(null)
                setLocationState("unknown")
                onEditComplete?.()
              }}
              className="w-full flex items-center gap-2"
            >
              Cancel Edit
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoCapture}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleVideoCapture}
        className="hidden"
      />
    </div>
  )
}
