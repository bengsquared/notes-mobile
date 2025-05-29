import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { QuickNotes } from '../../components/quick-notes'
import { DeepNotesManager } from '../../components/deep-notes-manager'
import { Inbox } from '../../components/inbox'
import { Button } from '../../components/ui/button'
import { PanelLeft, PanelLeftClose } from 'lucide-react'

declare global {
  interface Window {
    electronAPI: {
      onNotesReceived: (callback: (notes: any[]) => void) => void
    }
  }
}

export default function App() {
  const [inboxNotes, setInboxNotes] = useState<any[]>([])
  const [showQuickNotes, setShowQuickNotes] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onNotesReceived((notes) => {
        console.log('Frontend received notes:', notes);
        setInboxNotes(prev => {
          // Filter out notes that already exist to prevent duplicates
          const existingIds = new Set(prev.map(note => note.id))
          const newNotes = notes.filter(note => !existingIds.has(note.id))
          console.log('Adding new notes:', newNotes);
          return [...prev, ...newNotes]
        })
      })
    }
  }, [])

  return (
    <div className="flex flex-col h-screen">
      {/* Menu Bar */}
      <div className="flex items-center h-12 px-4 border-b bg-background">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowQuickNotes(!showQuickNotes)}
          title={showQuickNotes ? 'Hide Quick Notes' : 'Show Quick Notes'}
        >
          {showQuickNotes ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </Button>
        <h1 className="ml-4 text-sm font-semibold">Notes Desktop</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Quick Notes Sidebar */}
        {showQuickNotes && (
          <div className="w-1/3 border-r transition-all duration-200 ease-in-out">
            <QuickNotes />
          </div>
        )}
        
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
    </div>
  )
}