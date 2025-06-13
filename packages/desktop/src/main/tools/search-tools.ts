import type { ToolDefinition, NotesStorage, CreateSuccessResponse } from './types';

/**
 * Search and discovery tools for knowledge exploration
 * 
 * Example usage:
 * - search_knowledge: Search for "productivity systems" with detailed context
 * - get_knowledge_stats: Get overview of notes, concepts, and recent activity
 * - analyze_note_content: Parse content to extract concepts and references
 * - get_recent_notes: Find 10 most recently modified notes
 * - get_similar_notes: Find notes similar to "project-management.txt" based on shared concepts
 */
export const searchTools: ToolDefinition[] = [
  {
    name: 'search_knowledge',
    description: 'Intelligent search across the entire knowledge base including notes, concepts, and optionally ideas. Returns comprehensive results with context and relationships for AI analysis.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query - can be keywords, concepts, or natural language questions',
        },
        includeIdeas: {
          type: 'boolean',
          description: 'Include unprocessed ideas from inbox in search results',
          default: false,
        },
        conceptFilter: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Filter results by specific concepts',
        },
        contextDepth: {
          type: 'string',
          enum: ['summary', 'detailed', 'full'],
          description: 'Amount of context to return per result',
          default: 'detailed',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_knowledge_stats',
    description: 'Get system overview with counts and recent activity',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'analyze_note_content',
    description: 'Parse content to understand structure (concepts, links, references)',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'Note content to analyze',
        },
      },
      required: ['content'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_recent_notes',
    description: 'Get recently modified notes',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of notes to return (default: 5)',
          default: 5,
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_similar_notes',
    description: 'Find notes similar to a given note based on concepts',
    inputSchema: {
      type: 'object',
      properties: {
        filename: {
          type: 'string',
          description: 'The note filename to find similar notes for',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of similar notes to return (default: 5)',
          default: 5,
        },
      },
      required: ['filename'],
      additionalProperties: false,
    },
  }
];

// Tool logic implementations
export async function searchKnowledge(notesStorage: NotesStorage, query: string, options: any = {}, createSuccessResponse: CreateSuccessResponse) {
  const searchOptions = {
    includeInbox: options.includeIdeas || false,
    concepts: options.conceptFilter || undefined,
    sortBy: 'modified' as const
  };
  const noteResults = await notesStorage.searchNotes(query, searchOptions);
  const previewLength = options.contextDepth === 'full' ? 500 :
    options.contextDepth === 'summary' ? 50 : 150;
  const response = {
    query: query,
    totalResults: noteResults.length,
    contextDepth: options.contextDepth || 'detailed',
    aiGuidance: `Found ${noteResults.length} results. Use 'read_note' for full content, 'get_note_relationships' to explore connections, or 'capture_idea' to add related thoughts.`,
    results: noteResults.map((note: any) => ({
      filename: note.filename,
      title: note.metadata.title,
      location: note.location,
      preview: note.content.substring(0, previewLength).replace(/\n/g, ' ') + (note.content.length > previewLength ? '...' : ''),
      concepts: note.metadata.concepts || [],
      conceptCount: note.metadata.concepts?.length || 0,
      lastModified: note.metadata.modified,
      relevanceIndicators: {
        hasMatchingConcepts: options.conceptFilter ?
          note.metadata.concepts?.some((c: string) => options.conceptFilter.includes(c)) : false,
        isRecentlyModified: note.metadata.modified ?
          (new Date().getTime() - new Date(note.metadata.modified).getTime()) < (7 * 24 * 60 * 60 * 1000) : false
      }
    }))
  };
  return createSuccessResponse(response);
}

export async function getKnowledgeStats(notesStorage: NotesStorage, createSuccessResponse: CreateSuccessResponse) {
  const allNotes = await notesStorage.listNotes('all');
  const inboxNotes = await notesStorage.listNotes('inbox');
  const concepts = await notesStorage.listConcepts();
  const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentActivity = allNotes
    .filter((note: any) => note.metadata.modified && new Date(note.metadata.modified) > recentCutoff)
    .slice(0, 10)
    .map((note: any) => ({
      filename: note.filename,
      action: 'modified',
      date: note.metadata.modified,
    }));
  const stats = {
    totalNotes: allNotes.length,
    inboxCount: inboxNotes.length,
    conceptCount: concepts.length,
    recentActivity,
    workflow_reminder: inboxNotes.length > 0 ?
      `You have ${inboxNotes.length} inbox items that need processing. Consider using suggest_inbox_processing to get recommendations.` :
      "Inbox is clean! Use the inbox for quick captures of ideas and thoughts."
  };
  return createSuccessResponse(stats);
}

export async function analyzeNoteContent(notesStorage: NotesStorage, createSuccessResponse: CreateSuccessResponse, content: string) {
  const parsed = notesStorage.parseContent(content);
  return createSuccessResponse(parsed);
}