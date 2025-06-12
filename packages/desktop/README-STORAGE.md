# Notes Storage System

## File Structure

When you select a folder for your notes, the system creates this structure:

```
YourSelectedFolder/
├── inbox/                  # Quick notes waiting to be processed
│   ├── quick-note-2024.txt
│   ├── quick-note-2024.jpg    # Associated media
│   └── meeting-notes.txt
├── collections/           # Organization system
│   ├── work.json
│   ├── personal.json
│   └── projects.json
├── my-first-note.txt      # Regular notes
├── my-first-note-1234567890.png  # Media with timestamp
├── project-ideas.txt
├── project-ideas-1234567891.mp4  # Video attachment
└── daily-standup.txt
```

## Note Format

Each `.txt` file contains the note content with optional metadata at the end:

```
This is my note content. I can link to other notes using [[Project Ideas]] syntax.

Here's another paragraph with a link to [[Daily Standup]].

---
{
  "created": "2024-01-15T10:00:00Z",
  "modified": "2024-01-15T14:30:00Z",
  "collections": ["work", "projects"]
}
```

## Collection Format

Collections are stored as JSON files:

```json
{
  "id": "work",
  "name": "Work Notes",
  "created": "2024-01-15T10:00:00Z",
  "modified": "2024-01-15T14:30:00Z",
  "notes": ["project-ideas.txt", "daily-standup.txt"],
  "color": "#3B82F6",
  "icon": "briefcase"
}
```

## Media Storage

Media files are stored alongside notes with the same base filename:
- `my-note.txt` - The note content
- `my-note-1234567890.jpg` - Image attachment (with timestamp)
- `my-note-1234567891.mp3` - Audio attachment

The timestamp ensures unique filenames when multiple media files are attached.

## Key Features

1. **Plain Text Storage**: All notes are simple `.txt` files you can edit with any text editor
2. **Media Support**: Images, videos, and audio files stored alongside notes
3. **Linking**: Use `[[Note Title]]` to link between notes
4. **Collections**: Organize notes without folders - one note can be in multiple collections
5. **Inbox**: Quick capture area for notes to process later
6. **Metadata**: Optional JSON metadata at the end of files (after `---`)

## Storage Benefits

- **Portable**: Take your notes anywhere
- **Version Control**: Works great with Git
- **Future-proof**: Plain text files will always be readable
- **External Editing**: Edit with VS Code, Vim, or any text editor
- **Search**: Use grep, ripgrep, or any text search tool