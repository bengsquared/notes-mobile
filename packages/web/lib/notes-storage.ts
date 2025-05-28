export interface Note {
  id: string
  text: string
  attachments: Array<{
    type: "photo" | "video" | "audio"
    data: string // base64 data URL
    name: string
  }>
  location?: {
    lat: number
    lng: number
  }
  createdAt: string
}

const STORAGE_KEY = "notes-app-data"

export function saveNote(noteData: Omit<Note, "id">): Note {
  const note: Note = {
    ...noteData,
    id: generateId(),
  }

  const existingNotes = getAllNotes()
  const updatedNotes = [note, ...existingNotes]

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes))
  return note
}

export function updateNote(updatedNote: Note): void {
  const notes = getAllNotes()
  const updatedNotes = notes.map((note) => (note.id === updatedNote.id ? updatedNote : note))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedNotes))
}

export function getAllNotes(): Note[] {
  if (typeof window === "undefined") return []

  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (error) {
    console.error("Error reading notes from localStorage:", error)
    return []
  }
}

export function deleteNote(id: string): void {
  const notes = getAllNotes()
  const filteredNotes = notes.filter((note) => note.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredNotes))
}

export function exportNotes(): Note[] {
  return getAllNotes()
}

export function importNotes(newNotes: Note[]): void {
  const existingNotes = getAllNotes()
  const existingIds = new Set(existingNotes.map((note) => note.id))

  // Only add notes that don't already exist
  const uniqueNewNotes = newNotes.filter((note) => !existingIds.has(note.id))

  if (uniqueNewNotes.length > 0) {
    const allNotes = [...uniqueNewNotes, ...existingNotes]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allNotes))
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}
