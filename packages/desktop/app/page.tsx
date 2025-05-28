'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuickNotes } from '@/components/quick-notes'
import { DeepNotesManager } from '@/components/deep-notes-manager'
import { Inbox } from '@/components/inbox'

export default function Home() {
  const [inboxNotes, setInboxNotes] = useState<any[]>([])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onNotesReceived((notes) => {
        setInboxNotes(prev => [...prev, ...notes])
      })
    }
  }, [])

  return (
    <div className="flex h-screen">
      <div className="w-1/3 border-r">
        <QuickNotes />
      </div>
      
      <div className="flex-1">
        <Tabs defaultValue="inbox" className="h-full">
          <TabsList className="w-full">
            <TabsTrigger value="inbox" className="flex-1">
              Inbox ({inboxNotes.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex-1">
              Deep Notes
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="inbox" className="h-[calc(100%-40px)]">
            <Inbox 
              notes={inboxNotes} 
              onProcessNote={(note) => {
                setInboxNotes(prev => prev.filter(n => n.id !== note.id))
              }}
            />
          </TabsContent>
          
          <TabsContent value="notes" className="h-[calc(100%-40px)]">
            <DeepNotesManager />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}