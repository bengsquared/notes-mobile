import { ToolDefinition } from './types';
import type { NotesStorage, CreateSuccessResponse } from './types';

/**
 * Inbox and idea processing tools for the Deep Notes methodology
 * 
 * Example usage:
 * - capture_idea: Quickly save "Interesting thought about distributed systems"
 * - list_ideas: Review all unprocessed ideas in inbox
 * - suggest_inbox_processing: Get AI recommendations for organizing inbox
 * - promote_idea_to_note: Convert raw idea to structured note with title and concepts
 */
export const inboxTools: ToolDefinition[] = [
  {
    name: 'list_ideas',
    description: 'Get all ideas from inbox - these are raw captures/quick thoughts that need review and processing into structured notes',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'list_inbox_notes',
    description: 'Get all inbox notes - these are raw captures/quick thoughts that need review and processing into structured notes',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'capture_idea',
    description: 'Capture a new raw idea into the inbox for later processing. This is the entry point for all new thoughts, observations, and insights in the Deep Notes methodology.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The raw idea content - can be unstructured thoughts, observations, quotes, or insights',
        },
      },
      required: ['content'],
      additionalProperties: false,
    },
  },
  {
    name: 'promote_idea_to_note',
    description: 'Transform a raw idea from the inbox into a structured note with title and concepts. This is the key processing step in the Deep Notes methodology.',
    inputSchema: {
      type: 'object',
      properties: {
        ideaFilename: {
          type: 'string',
          description: 'The inbox idea filename to promote',
        },
        title: {
          type: 'string',
          description: 'Clear, descriptive title for the structured note',
        },
        concepts: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Key concepts to tag this note with for knowledge graph connections',
        },
      },
      required: ['ideaFilename', 'title'],
      additionalProperties: false,
    },
  },
  {
    name: 'suggest_inbox_processing',
    description: 'AI-powered analysis of inbox ideas with specific processing recommendations. Returns actionable suggestions for promoting ideas to notes, extracting concepts, and identifying connections.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  }
];

// Tool logic implementations
export async function captureIdea(notesStorage: NotesStorage, content: string, createSuccessResponse: CreateSuccessResponse) {
  const metadata = {
    title: content.substring(0, 50).replace(/[\r\n]+/g, ' ').trim() + (content.length > 50 ? '...' : ''),
    created: new Date().toISOString(),
    processed: false
  };
  
  const idea = await notesStorage.createIdea(content, metadata);
  
  return createSuccessResponse({
    filename: idea.filename,
    content,
    created: metadata.created,
    message: 'Idea captured successfully. Use list_inbox_notes to review and suggest_inbox_processing for recommendations.'
  });
}

export async function listInboxNotes(notesStorage: NotesStorage, createSuccessResponse: CreateSuccessResponse) {
  const notes = await notesStorage.listNotes('inbox');
  const inboxNotesWithContent = await Promise.all(
    notes.map(async (note: any) => {
      const fullNote = await notesStorage.loadNote(note.filename);
      const media = await notesStorage.listMediaForNote(note.filename);
      return {
        filename: note.filename,
        content: fullNote.content,
        created: note.metadata.created,
        hasMedia: media.length > 0,
      };
    })
  );
  const result = {
    workflow_note: "These are raw captures that need review. Users should regularly process inbox items by either: 1) Adding content to existing notes, 2) Creating new structured notes, or 3) Extracting concepts and relationships",
    inbox_count: inboxNotesWithContent.length,
    items: inboxNotesWithContent
  };
  return createSuccessResponse(result);
}

export async function suggestInboxProcessing(notesStorage: NotesStorage, createSuccessResponse: CreateSuccessResponse) {
  const inboxNotes = await notesStorage.listNotes('inbox');
  if (inboxNotes.length === 0) {
    return createSuccessResponse({
      workflow_guidance: "Inbox is clean! Use the inbox for quick captures of ideas and thoughts.",
      total_inbox_items: 0,
      processing_suggestions: []
    });
  }
  const maxInboxItems = 10;
  const itemsToProcess = inboxNotes.slice(0, maxInboxItems);
  const allNotes = await notesStorage.listNotes('notes');
  const allConceptNames = (await notesStorage.listConcepts()).map((c: any) => c.name);
  const suggestions: any[] = [];
  for (const inboxNote of itemsToProcess) {
    const fullNote = await notesStorage.loadNote(inboxNote.filename);
    const parsed = notesStorage.parseContent(fullNote.content);
    const potentialMatches: any[] = [];
    for (const note of allNotes) {
      const noteConcepts = note.metadata.concepts || [];
      const overlap = parsed.concepts.filter((c: string) => noteConcepts.includes(c));
      if (overlap.length > 0) {
        potentialMatches.push({
          filename: note.filename,
          title: note.metadata.title,
          sharedConcepts: overlap,
          score: overlap.length
        });
      }
    }
    potentialMatches.sort((a, b) => b.score - a.score);
    const newConcepts = parsed.concepts.filter((c: string) => !allConceptNames.includes(c));
    suggestions.push({
      inboxFile: inboxNote.filename,
      content: fullNote.content.substring(0, 100) + (fullNote.content.length > 100 ? '...' : ''),
      created: fullNote.metadata.created,
      extractedConcepts: parsed.concepts,
      newConcepts,
      potentialMergeTargets: potentialMatches.slice(0, 3),
      processingOptions: [
        potentialMatches.length > 0 ? 'Merge with existing note' : null,
        'Create new structured note',
        newConcepts.length > 0 ? 'Extract new concepts' : null,
        'Archive as reference'
      ].filter(Boolean)
    });
  }
  const result = {
    workflow_guidance: "Regular inbox processing helps maintain a clean knowledge base. Process items by reviewing content, extracting concepts, and either merging with existing notes or creating new structured notes.",
    total_inbox_items: inboxNotes.length,
    processing_suggestions: suggestions,
    note: inboxNotes.length > maxInboxItems ?
      `Showing suggestions for first ${maxInboxItems} items (of ${inboxNotes.length} total) for performance.` : undefined
  };
  return createSuccessResponse(result);
}

export async function promoteIdeaToNote(notesStorage: NotesStorage, ideaFilename: string, title: string, concepts: string[] = [], createSuccessResponse?: CreateSuccessResponse) {
  try {
    const promotedNote = await notesStorage.promoteIdeaToNote(ideaFilename, title, concepts);
    
    const result = {
      filename: promotedNote.filename,
      title: promotedNote.metadata.title,
      concepts: promotedNote.metadata.concepts || [],
      created: promotedNote.metadata.created,
      message: `Successfully promoted idea to structured note: ${promotedNote.filename}`
    };
    
    return createSuccessResponse ? createSuccessResponse(result) : {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = `Error promoting idea to note: ${error instanceof Error ? error.message : String(error)}`;
    return createSuccessResponse ? createSuccessResponse({ error: errorMessage }) : {
      content: [{
        type: 'text',
        text: errorMessage
      }]
    };
  }
}

export async function processInboxItem(notesStorage: NotesStorage, filename: string, options: any, createSuccessResponse?: CreateSuccessResponse) {
  const inboxNote = await notesStorage.loadNote(filename);
  switch (options.action) {
    case 'create_note': {
      if (!options.targetFilename) throw new Error('targetFilename required for create_note action');
      await notesStorage.saveNote(options.targetFilename, inboxNote.content, inboxNote.metadata, 'notes');
      await notesStorage.deleteNote(filename);
      if (options.title || options.concepts) {
        const metadata = {
          ...inboxNote.metadata,
          title: options.title || inboxNote.metadata.title,
          concepts: options.concepts || inboxNote.metadata.concepts,
          modified: new Date().toISOString()
        };
        await notesStorage.saveNote(options.targetFilename, inboxNote.content, metadata);
      }
      const result = { message: `Moved inbox item to ${options.targetFilename}`, targetFilename: options.targetFilename };
      return createSuccessResponse ? createSuccessResponse(result) : {
        content: [
          { type: 'text', text: JSON.stringify(result, null, 2) },
        ],
      };
    }
    case 'merge_with_note': {
      if (!options.targetFilename) throw new Error('targetFilename required for merge_with_note action');
      const targetNote = await notesStorage.loadNote(options.targetFilename);
      const newContent = options.appendContent
        ? `${targetNote.content}\n\n${inboxNote.content}`
        : `${inboxNote.content}\n\n${targetNote.content}`;
      const mergedConcepts = options.concepts || targetNote.metadata.concepts || [];
      if (inboxNote.metadata.concepts) {
        mergedConcepts.push(...inboxNote.metadata.concepts);
      }
      await notesStorage.saveNote(options.targetFilename, newContent, {
        ...targetNote.metadata,
        title: options.title || targetNote.metadata.title,
        concepts: [...new Set(mergedConcepts)],
        modified: new Date().toISOString()
      });
      await notesStorage.deleteNote(filename);
      const result = { message: `Merged inbox item into ${options.targetFilename}`, targetFilename: options.targetFilename };
      return createSuccessResponse ? createSuccessResponse(result) : {
        content: [
          { type: 'text', text: JSON.stringify(result, null, 2) },
        ],
      };
    }
    case 'delete': {
      await notesStorage.deleteNote(filename);
      const result = { message: `Deleted inbox item ${filename}`, filename };
      return createSuccessResponse ? createSuccessResponse(result) : {
        content: [
          { type: 'text', text: JSON.stringify(result, null, 2) },
        ],
      };
    }
    default:
      throw new Error('Unknown action for processInboxItem');
  }
}