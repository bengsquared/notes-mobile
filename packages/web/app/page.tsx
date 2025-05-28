"use client"

import { useState } from "react"
import ComposeNote from "@/components/compose-note"
import NotesList from "@/components/notes-list"
import TransferNotes from "@/components/transfer-notes"
import { Button } from "@/components/ui/button"
import { PlusCircle, List, Wifi } from "lucide-react"

export default function NotesApp() {
  const [currentView, setCurrentView] = useState<"compose" | "list" | "transfer">("compose")
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleNoteCreated = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Notes</h1>
        <div className="flex gap-2">
          <Button
            variant={currentView === "compose" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrentView("compose")}
            className="flex items-center gap-1"
          >
            <PlusCircle className="w-4 h-4" />
            New
          </Button>
          <Button
            variant={currentView === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrentView("list")}
            className="flex items-center gap-1"
          >
            <List className="w-4 h-4" />
            Browse
          </Button>
          <Button
            variant={currentView === "transfer" ? "default" : "outline"}
            size="sm"
            onClick={() => setCurrentView("transfer")}
            className="flex items-center gap-1"
          >
            <Wifi className="w-4 h-4" />
            Transfer
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {currentView === "compose" && <ComposeNote onNoteCreated={handleNoteCreated} />}
        {currentView === "list" && <NotesList key={refreshTrigger} />}
        {currentView === "transfer" && <TransferNotes />}
      </div>
    </div>
  )
}
