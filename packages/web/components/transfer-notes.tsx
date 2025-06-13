"use client"

import UnifiedTransfer from "@/components/unified-transfer"
import ExportNotes from "@/components/export-notes"

export default function TransferNotes() {
  return (
    <div className="space-y-4">
      <UnifiedTransfer />
      <ExportNotes />
    </div>
  )
}
