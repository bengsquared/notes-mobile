// Legacy storage interfaces - deprecated, use types.ts instead
export interface LegacyNote {
  filename: string;
  title: string;
  content: string;
  metadata?: LegacyNoteMetadata;
  media?: LegacyMediaFile[];
}

export interface LegacyMediaFile {
  filename: string;
  type: 'image' | 'video' | 'audio';
  size: number;
  mimeType?: string;
}

export interface LegacyNoteMetadata {
  created: string;
  modified: string;
  collections: string[];
}

export interface LegacyCollection {
  id: string;
  name: string;
  created: string;
  modified: string;
  notes: string[]; // filenames
  color?: string;
  icon?: string;
}

export interface LegacyStorageConfig {
  notesDirectory: string | null;
  inboxPath: string;
  collectionsPath: string;
}

export const METADATA_SEPARATOR = '\n\n---\n';
export const LINK_PATTERN = /\[\[([^\]]+)\]\]/g;