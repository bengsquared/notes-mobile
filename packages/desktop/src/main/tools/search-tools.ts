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
export async function searchKnowledge(notesStorage: NotesStorage, query: string, includeIdeas?: boolean, conceptFilter?: string[], contextDepth?: string, createSuccessResponse?: CreateSuccessResponse) {
  const searchOptions = {
    includeInbox: includeIdeas || false,
    concepts: conceptFilter || undefined,
    sortBy: 'modified' as const
  };
  const noteResults = await notesStorage.searchNotes(query, searchOptions);
  const previewLength = contextDepth === 'full' ? 500 :
    contextDepth === 'summary' ? 50 : 150;
  const response = {
    query: query,
    totalResults: noteResults.length,
    contextDepth: contextDepth || 'detailed',
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
        hasMatchingConcepts: conceptFilter ?
          note.metadata.concepts?.some((c: string) => conceptFilter.includes(c)) : false,
        isRecentlyModified: note.metadata.modified ?
          (new Date().getTime() - new Date(note.metadata.modified).getTime()) < (7 * 24 * 60 * 60 * 1000) : false
      }
    }))
  };
  return createSuccessResponse ? createSuccessResponse(response) : {
    content: [{
      type: 'text',
      text: JSON.stringify(response, null, 2)
    }]
  };
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

export async function analyzeNoteContent(notesStorage: NotesStorage, content: string, createSuccessResponse?: CreateSuccessResponse) {
  try {
    // Ensure content is a string - handle case where createSuccessResponse might be passed as content
    let actualContent = content;
    let actualCreateSuccessResponse = createSuccessResponse;
    
    // Check if the arguments are in the wrong order (content is actually createSuccessResponse)
    if (typeof content === 'function') {
      // Arguments are mixed up, content is actually createSuccessResponse
      actualContent = '';
      actualCreateSuccessResponse = content as any;
    }
    
    const contentStr = String(actualContent || '');
    const parsed = notesStorage.parseContent(contentStr);
    return actualCreateSuccessResponse ? actualCreateSuccessResponse(parsed) : {
      content: [{
        type: 'text',
        text: JSON.stringify(parsed, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = `Error analyzing note content: ${error instanceof Error ? error.message : String(error)}`;
    return createSuccessResponse ? createSuccessResponse({ error: errorMessage }) : {
      content: [{
        type: 'text',
        text: errorMessage
      }]
    };
  }
}

export async function getRecentNotes(notesStorage: NotesStorage, limit: number = 5, createSuccessResponse?: CreateSuccessResponse) {
  try {
    const allNotes = await notesStorage.listNotes('all');
    
    // Sort by modified date, most recent first
    const sortedNotes = allNotes
      .filter((note: any) => note.metadata.modified)
      .sort((a: any, b: any) => new Date(b.metadata.modified).getTime() - new Date(a.metadata.modified).getTime())
      .slice(0, limit);
      
    const recentNotesWithContent = await Promise.all(
      sortedNotes.map(async (note: any) => {
        const fullNote = await notesStorage.loadNote(note.filename);
        const preview = fullNote.content.substring(0, 150).replace(/\n/g, ' ');
        return {
          filename: note.filename,
          title: note.metadata.title,
          location: note.location,
          modified: note.metadata.modified,
          created: note.metadata.created,
          conceptCount: note.metadata.concepts?.length || 0,
          linkCount: note.metadata.links?.length || 0,
          preview: preview + (fullNote.content.length > 150 ? '...' : '')
        };
      })
    );
    
    const result = {
      count: recentNotesWithContent.length,
      limit,
      notes: recentNotesWithContent,
      message: `Found ${recentNotesWithContent.length} recently modified notes`
    };
    
    return createSuccessResponse ? createSuccessResponse(result) : {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = `Error getting recent notes: ${error instanceof Error ? error.message : String(error)}`;
    return createSuccessResponse ? createSuccessResponse({ error: errorMessage }) : {
      content: [{
        type: 'text',
        text: errorMessage
      }]
    };
  }
}

export async function getSimilarNotes(notesStorage: NotesStorage, filename: string, limit: number = 5, createSuccessResponse?: CreateSuccessResponse) {
  try {
    // Get the target note's concepts
    const targetNote = await notesStorage.loadNote(filename);
    if (!targetNote || !targetNote.metadata.concepts || targetNote.metadata.concepts.length === 0) {
      const result = {
        filename,
        similarNotes: [],
        message: 'No similar notes found (target note has no concepts)'
      };
      return createSuccessResponse ? createSuccessResponse(result) : {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    }

    // Get all notes and calculate similarity based on shared concepts
    const allNotes = await notesStorage.listNotes('all');
    const notesWithScores = allNotes
      .filter((note: any) => note.filename !== filename && note.metadata.concepts?.length > 0)
      .map((note: any) => {
        const sharedConcepts = note.metadata.concepts.filter((c: string) => 
          targetNote.metadata.concepts.includes(c)
        );
        const totalConcepts = new Set([...note.metadata.concepts, ...targetNote.metadata.concepts]).size;
        const score = sharedConcepts.length / totalConcepts;
        return { note, score, sharedConcepts };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const similarNotes = await Promise.all(
      notesWithScores.map(async ({ note, score, sharedConcepts }) => {
        const fullNote = await notesStorage.loadNote(note.filename);
        return {
          filename: note.filename,
          title: note.metadata.title,
          similarityScore: Math.round(score * 100),
          sharedConcepts,
          conceptCount: note.metadata.concepts.length,
          preview: fullNote.content.substring(0, 150).replace(/\n/g, ' ') + '...'
        };
      })
    );

    const result = {
      filename,
      similarNotes,
      message: `Found ${similarNotes.length} similar notes based on shared concepts`
    };

    return createSuccessResponse ? createSuccessResponse(result) : {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    const errorMessage = `Error finding similar notes: ${error instanceof Error ? error.message : String(error)}`;
    return createSuccessResponse ? createSuccessResponse({ error: errorMessage }) : {
      content: [{
        type: 'text',
        text: errorMessage
      }]
    };
  }
}