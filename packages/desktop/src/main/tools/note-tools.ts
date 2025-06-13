import { ToolDefinition } from './types';
import type { NotesStorage, CreateSuccessResponse } from './types';

/**
 * Core note management tools
 * 
 * Example usage:
 * - list_all_notes: Get overview of all structured notes
 * - read_note: Read full content of "my-project-ideas.txt"
 * - get_note_relationships: Find all concepts and links for a specific note
 * - enrich_note: Add new content or concepts to existing note
 * - merge_notes: Combine multiple related notes into one
 * - rename_note: Change note filename from "draft.txt" to "final-thoughts.txt"
 */
export const noteTools: ToolDefinition[] = [
  {
    name: 'list_all_notes',
    description: 'Get overview of all structured notes (excludes inbox) with titles, metadata, and previews',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'read_note',
    description: 'Read specific note with full content',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename of the note to read',
        },
      },
      required: ['filename'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_note_relationships',
    description: 'Get relationships for a specific note (concepts, links, backlinks)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename of the note',
        },
      },
      required: ['filename'],
      additionalProperties: false,
    },
  },
  {
    name: 'enrich_note',
    description: 'Enhance an existing note with additional content, concepts, or connections. Supports both content expansion and metadata enrichment.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename of the note to enrich',
        },
        additionalContent: {
          type: 'string',
          description: 'New content to append to the note',
        },
        newConcepts: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Additional concepts to tag this note with',
        },
        newLinks: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Additional note connections to establish',
        },
      },
      required: ['filename'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_concepts_to_note',
    description: 'Add concepts to a note without replacing existing ones',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename of the note',
        },
        concepts: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Concepts to add to the note',
        },
      },
      required: ['filename', 'concepts'],
      additionalProperties: false,
    },
  },
  {
    name: 'remove_concepts_from_note',
    description: 'Remove specific concepts from a note',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename of the note',
        },
        concepts: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Concepts to remove from the note',
        },
      },
      required: ['filename', 'concepts'],
      additionalProperties: false,
    },
  },
  {
    name: 'add_links_to_note',
    description: 'Add links to other notes without replacing existing ones',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename of the note',
        },
        links: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Note filenames to link to',
        },
      },
      required: ['filename', 'links'],
      additionalProperties: false,
    },
  },
  {
    name: 'remove_links_from_note',
    description: 'Remove specific links from a note',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The filename of the note',
        },
        links: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Note filenames to unlink',
        },
      },
      required: ['filename', 'links'],
      additionalProperties: false,
    },
  },
  {
    name: 'merge_notes',
    description: 'Merge multiple notes into one',
    inputSchema: {
      type: 'object',
      properties: {
        sourceFilenames: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Notes to merge from',
        },
        targetFilename: {
          type: 'string',
          description: 'Note to merge into',
        },
        mergeStrategy: {
          type: 'string',
          enum: ['append', 'sections', 'chronological'],
          description: 'How to merge content (default: sections)',
          default: 'sections',
        },
        deleteSource: {
          type: 'boolean',
          description: 'Delete source notes after merging (default: false)',
          default: false,
        },
      },
      required: ['sourceFilenames', 'targetFilename'],
      additionalProperties: false,
    },
  },
  {
    name: 'rename_note',
    description: 'Rename a note file',
    inputSchema: {
      type: 'object',
      properties: {
        oldFilename: {
          type: 'string',
          description: 'Current filename of the note',
        },
        newFilename: {
          type: 'string',
          description: 'New filename for the note',
        },
      },
      required: ['oldFilename', 'newFilename'],
      additionalProperties: false,
    },
  }
];

// Tool logic stubs for note-tools
export async function listAllNotes(notesStorage: any, createSuccessResponse: (data: any) => any) {
  const notes = await notesStorage.listNotes('all');
  if (notes.length > 20) {
    const noteSummaries = notes.map((note: any) => ({
      filename: note.filename,
      title: note.metadata.title,
      location: note.location,
      created: note.metadata.created,
      modified: note.metadata.modified,
      conceptCount: note.metadata.concepts?.length || 0,
      linkCount: note.metadata.links?.length || 0,
    }));
    return createSuccessResponse({
      count: notes.length,
      notes: noteSummaries,
      message: `Listed ${notes.length} notes (summaries only for performance). Use read_note to get full content.`
    });
  }
  const notesWithPreviews = await Promise.all(
    notes.map(async (note: any) => {
      const fullNote = await notesStorage.loadNote(note.filename);
      const preview = fullNote.content.substring(0, 100).replace(/\n/g, ' ');
      return {
        filename: note.filename,
        title: note.metadata.title,
        location: note.location,
        metadata: note.metadata,
        preview
      };
    })
  );
  return createSuccessResponse({
    count: notes.length,
    notes: notesWithPreviews
  });
}

export async function readNote(notesStorage: any, filename: string, createSuccessResponse: (data: any) => any) {
  const note = await notesStorage.loadNote(filename);
  return createSuccessResponse(note);
}

export async function getNoteRelationships(notesStorage: any, filename: string, createSuccessResponse: (data: any) => any) {
  const note = await notesStorage.loadNote(filename);
  const allNotes = await notesStorage.listNotes('all');
  const backlinks: string[] = [];
  for (const otherNote of allNotes) {
    if (otherNote.filename === filename) continue;
    const fullNote = await notesStorage.loadNote(otherNote.filename);
    if (fullNote.metadata.links?.includes(filename) ||
      fullNote.content.includes(`@${note.metadata.title}`) ||
      fullNote.content.includes(`@${filename}`)) {
      backlinks.push(otherNote.filename);
    }
  }
  const relationships = {
    linkedConcepts: note.metadata.concepts || [],
    referencedNotes: note.metadata.links || [],
    backlinks,
  };
  return createSuccessResponse(relationships);
}

export async function enrichNote(notesStorage: NotesStorage, filename: string, additionalContent?: string, newConcepts: string[] = [], newLinks: string[] = [], createSuccessResponse?: CreateSuccessResponse) {
  const note = await notesStorage.loadNote(filename);
  
  // Merge content
  const enrichedContent = additionalContent 
    ? `${note.content}\n\n## Enrichment (${new Date().toLocaleDateString()})\n\n${additionalContent}`
    : note.content;
  
  // Merge concepts
  const existingConcepts = note.metadata.concepts || [];
  const mergedConcepts = [...new Set([...existingConcepts, ...newConcepts])];
  
  // Merge links
  const existingLinks = note.metadata.links || [];
  const mergedLinks = [...new Set([...existingLinks, ...newLinks])];
  
  // Update metadata
  const updatedMetadata = {
    ...note.metadata,
    concepts: mergedConcepts,
    links: mergedLinks,
    modified: new Date().toISOString()
  };
  
  await notesStorage.saveNote(filename, enrichedContent, updatedMetadata);
  
  const result = {
    filename,
    addedConcepts: newConcepts.filter(c => !existingConcepts.includes(c)),
    addedLinks: newLinks.filter(l => !existingLinks.includes(l)),
    contentAdded: !!additionalContent
  };
  
  return createSuccessResponse ? createSuccessResponse(result) : {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2)
    }]
  };
}

export async function mergeNotes(notesStorage: any, sourceFilenames: string[], targetFilename: string, options: { title?: string; mergeStrategy: 'append' | 'sections' | 'chronological'; deleteSource: boolean; }) {
  const sourceNotes = await Promise.all(
    sourceFilenames.map(filename => notesStorage.loadNote(filename))
  );
  let targetNote;
  let targetExists = false;
  try {
    targetNote = await notesStorage.loadNote(targetFilename);
    targetExists = true;
  } catch {
    // Target doesn't exist, will create new
  }
  if (options.mergeStrategy === 'chronological') {
    sourceNotes.sort((a, b) =>
      new Date(a.metadata.created || 0).getTime() - new Date(b.metadata.created || 0).getTime()
    );
  }
  let mergedContent = '';
  if (targetExists && targetNote) {
    mergedContent = targetNote.content;
  }
  for (const note of sourceNotes) {
    if (mergedContent) mergedContent += '\n\n';
    if (options.mergeStrategy === 'sections') {
      mergedContent += `## ${note.metadata.title || note.filename}\n\n`;
    }
    mergedContent += note.content;
  }
  const allConcepts: string[] = targetNote?.metadata.concepts || [];
  const allLinks: string[] = targetNote?.metadata.links || [];
  for (const note of sourceNotes) {
    if (note.metadata.concepts) allConcepts.push(...note.metadata.concepts);
    if (note.metadata.links) allLinks.push(...note.metadata.links);
  }
  const metadata = {
    title: options.title || targetNote?.metadata.title || 'Merged Note',
    concepts: [...new Set(allConcepts)],
    links: [...new Set(allLinks)],
    created: targetNote?.metadata.created || new Date().toISOString(),
    modified: new Date().toISOString()
  };
  await notesStorage.saveNote(targetFilename, mergedContent, metadata);
  if (options.deleteSource) {
    for (const filename of sourceFilenames) {
      await notesStorage.deleteNote(filename);
    }
  }
  return {
    content: [
      {
        type: 'text',
        text: `Merged ${sourceFilenames.length} notes into ${targetFilename}${options.deleteSource ? ' and deleted source notes' : ''}`,
      },
    ],
  };
}

export async function renameNote(notesStorage: any, oldFilename: string, newFilename: string) {
  await notesStorage.renameNote(oldFilename, newFilename);
  return {
    content: [
      {
        type: 'text',
        text: `Successfully renamed ${oldFilename} to ${newFilename}`,
      },
    ],
  };
}

export async function updateNoteContent(notesStorage: any, filename: string, content: string) {
  const note = await notesStorage.loadNote(filename);
  await notesStorage.saveNote(filename, content, {
    ...note.metadata,
    modified: new Date().toISOString()
  });
  return {
    content: [
      {
        type: 'text',
        text: `Successfully updated content of ${filename}`,
      },
    ],
  };
}

export async function updateNoteMetadata(notesStorage: any, filename: string, updates: { title?: string; concepts?: string[]; links?: string[] }) {
  const note = await notesStorage.loadNote(filename);
  const metadata = { ...note.metadata };

  if (updates.title !== undefined) metadata.title = updates.title;
  if (updates.concepts !== undefined) metadata.concepts = updates.concepts;
  if (updates.links !== undefined) metadata.links = updates.links;

  metadata.modified = new Date().toISOString();

  await notesStorage.saveNote(filename, note.content, metadata);

  return {
    content: [
      {
        type: 'text',
        text: `Successfully updated metadata for ${filename}`,
      },
    ],
  };
}

export async function addConceptsToNote(notesStorage: NotesStorage, filename: string, conceptsToAdd: string[]) {
  const note = await notesStorage.loadNote(filename);
  const existingConcepts = note.metadata.concepts || [];
  const newConcepts = [...new Set([...existingConcepts, ...conceptsToAdd])];
  await notesStorage.saveNote(filename, note.content, {
    ...note.metadata,
    concepts: newConcepts,
    modified: new Date().toISOString()
  });
  return {
    content: [
      {
        type: 'text',
        text: `Added ${conceptsToAdd.length} concepts to ${filename}. Total concepts: ${newConcepts.length}`,
      },
    ],
  };
}

export async function removeConceptsFromNote(notesStorage: NotesStorage, filename: string, conceptsToRemove: string[]) {
  const note = await notesStorage.loadNote(filename);
  const existingConcepts = note.metadata.concepts || [];
  const newConcepts = existingConcepts.filter((c: string) => !conceptsToRemove.includes(c));
  await notesStorage.saveNote(filename, note.content, {
    ...note.metadata,
    concepts: newConcepts,
    modified: new Date().toISOString()
  });
  return {
    content: [
      {
        type: 'text',
        text: `Removed ${existingConcepts.length - newConcepts.length} concepts from ${filename}. Remaining concepts: ${newConcepts.length}`,
      },
    ],
  };
}

export async function addLinksToNote(notesStorage: NotesStorage, filename: string, linksToAdd: string[]) {
  const note = await notesStorage.loadNote(filename);
  const existingLinks = note.metadata.links || [];
  const newLinks = [...new Set([...existingLinks, ...linksToAdd])];
  await notesStorage.saveNote(filename, note.content, {
    ...note.metadata,
    links: newLinks,
    modified: new Date().toISOString()
  });
  return {
    content: [
      {
        type: 'text',
        text: `Added ${linksToAdd.length} links to ${filename}. Total links: ${newLinks.length}`,
      },
    ],
  };
}

export async function removeLinksFromNote(notesStorage: NotesStorage, filename: string, linksToRemove: string[]) {
  const note = await notesStorage.loadNote(filename);
  const existingLinks = note.metadata.links || [];
  const newLinks = existingLinks.filter((l: string) => !linksToRemove.includes(l));
  await notesStorage.saveNote(filename, note.content, {
    ...note.metadata,
    links: newLinks,
    modified: new Date().toISOString()
  });
  return {
    content: [
      {
        type: 'text',
        text: `Removed ${existingLinks.length - newLinks.length} links from ${filename}. Remaining links: ${newLinks.length}`,
      },
    ],
  };
}