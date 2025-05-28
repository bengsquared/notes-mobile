interface ElectronAPI {
  onNotesReceived: (callback: (notes: any[]) => void) => void
  getNotesDirectory: () => Promise<string>
  setNotesDirectory: (path: string) => Promise<boolean>
  saveNote: (filename: string, content: string) => Promise<boolean>
  loadNote: (filename: string) => Promise<string>
  listNotes: () => Promise<string[]>
  deleteNote: (filename: string) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}