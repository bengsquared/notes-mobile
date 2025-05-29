"use client"

import { useState } from "react"
import ComposeNote from "@/components/compose-note"
import NotesList from "@/components/notes-list"
import TransferNotes from "@/components/transfer-notes"
import { Button } from "@/components/ui/button"
import { PlusCircle, List, Wifi } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

export default function NotesApp() {
  const [currentView, setCurrentView] = useState<"compose" | "list" | "transfer">("compose")
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const isMobile = useIsMobile()

  const handleNoteCreated = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  const navigationButtons = (
    <>
      <Button
        variant={currentView === "compose" ? "default" : "outline"}
        size={isMobile ? "default" : "sm"}
        onClick={() => setCurrentView("compose")}
        className={isMobile ? "flex-1 flex flex-col items-center gap-1 h-auto py-2" : "flex items-center gap-1"}
      >
        <PlusCircle className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
        <span className={isMobile ? "text-xs" : ""}>New</span>
      </Button>
      <Button
        variant={currentView === "list" ? "default" : "outline"}
        size={isMobile ? "default" : "sm"}
        onClick={() => setCurrentView("list")}
        className={isMobile ? "flex-1 flex flex-col items-center gap-1 h-auto py-2" : "flex items-center gap-1"}
      >
        <List className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
        <span className={isMobile ? "text-xs" : ""}>Browse</span>
      </Button>
      <Button
        variant={currentView === "transfer" ? "default" : "outline"}
        size={isMobile ? "default" : "sm"}
        onClick={() => setCurrentView("transfer")}
        className={isMobile ? "flex-1 flex flex-col items-center gap-1 h-auto py-2" : "flex items-center gap-1"}
      >
        <Wifi className={isMobile ? "w-5 h-5" : "w-4 h-4"} />
        <span className={isMobile ? "text-xs" : ""}>Transfer</span>
      </Button>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Notes</h1>
        {/* Show navigation in header only on desktop */}
        {!isMobile && (
          <div className="flex gap-2">
            {navigationButtons}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className={`flex-1 p-4 ${isMobile ? 'pb-20' : ''}`}>
        {currentView === "compose" && <ComposeNote onNoteCreated={handleNoteCreated} />}
        {currentView === "list" && <NotesList key={refreshTrigger} />}
        {currentView === "transfer" && <TransferNotes />}
      </div>

      {/* Bottom Navigation - Mobile Only */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-bottom">
          <div className="flex gap-2">
            {navigationButtons}
          </div>
        </div>
      )}
    </div>
  )
}
