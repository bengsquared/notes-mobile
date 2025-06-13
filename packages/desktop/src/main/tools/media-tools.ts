import { ToolDefinition } from './types';
import type { NotesStorage, CreateSuccessResponse } from './types';

/**
 * Media and attachment management tools
 * 
 * Example usage:
 * - save_media: Save an image from base64 data with filename "diagram.png"
 * - list_media_for_note: Get all attachments for "research-notes.txt"
 * - load_media: Retrieve base64 data for "screenshot.png"
 * - delete_media: Remove unused attachment "old-draft.pdf"
 */
export const mediaTools: ToolDefinition[] = [
  {
    name: 'list_media_for_note',
    description: 'List all media files associated with a note',
    inputSchema: {
      type: 'object',
      properties: {
        noteFilename: {
          type: 'string',
          description: 'The note filename to get media for',
        },
      },
      required: ['noteFilename'],
      additionalProperties: false,
    },
  },
  {
    name: 'save_media',
    description: 'Save a media file associated with a note',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'Filename for the media file',
        },
        data: {
          type: 'string',
          description: 'Base64 encoded media data',
        },
        mimeType: {
          type: 'string',
          description: 'MIME type of the media file',
        },
      },
      required: ['filename', 'data', 'mimeType'],
      additionalProperties: false,
    },
  },
  {
    name: 'load_media',
    description: 'Load a media file by filename',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The media filename to load',
        },
      },
      required: ['filename'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_media',
    description: 'Delete a media file',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The media filename to delete',
        },
      },
      required: ['filename'],
      additionalProperties: false,
    },
  }
];

// Tool logic implementations
export async function listMediaForNote(notesStorage: any, createSuccessResponse: Function, noteFilename: string) {
  const mediaFiles = await notesStorage.listMediaForNote(noteFilename);
  return createSuccessResponse(mediaFiles);
}

export async function saveMedia(notesStorage: any, filename: string, data: string, mimeType: string) {
  await notesStorage.saveMedia(filename, data, mimeType);
  return {
    content: [
      {
        type: 'text',
        text: `Successfully saved media file: ${filename}`,
      },
    ],
  };
}

export async function loadMedia(notesStorage: NotesStorage, createSuccessResponse: CreateSuccessResponse, filename: string) {
  const media = await notesStorage.loadMedia(filename);
  return createSuccessResponse(media);
}

export async function deleteMedia(notesStorage: NotesStorage, filename: string) {
  await notesStorage.deleteMedia(filename);
  return {
    content: [
      {
        type: 'text',
        text: `Successfully deleted media file: ${filename}`,
      },
    ],
  };
}