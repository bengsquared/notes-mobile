import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { NotesStorage } from '../lib/storage';
import Store from 'electron-store';
import { app } from 'electron';
import path from 'path';
import os from 'os';
import { promises as fs } from 'fs';

export class NotesMCPServer {
  private server: Server;
  private notesStorage: NotesStorage | null = null;
  private store: Store;

  constructor() {
    this.store = new Store({
      name: 'notes-app-config' // Use consistent name for both dev and production
    });
    this.server = new Server(
      {
        name: 'notes-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Add global error handler
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception in MCP server:', error);
    });
    
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection in MCP server:', reason);
    });

    this.setupHandlers();
  }

  setNotesStorage(storage: NotesStorage) {
    this.notesStorage = storage;
  }

  private createErrorResponse(message: string) {
    return {
      content: [
        {
          type: 'text',
          text: message,
        },
      ],
    };
  }

  private createSuccessResponse(data: any) {
    return {
      content: [
        {
          type: 'text',
          text: typeof data === 'string' ? data : JSON.stringify(data, null, 2),
        },
      ],
    };
  }

  private setupHandlers() {

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_storage_config',
            description: 'Get current storage configuration status and directory path',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: 'configure_notes_directory',
            description: 'Set the notes directory path for the application',
            inputSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Absolute path to the notes directory',
                },
              },
              required: ['path'],
              additionalProperties: false,
            },
          },
          {
            name: 'generate_mcp_configuration',
            description: 'Generate Claude Desktop MCP configuration for this app installation',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
          },
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
            name: 'list_all_concepts',
            description: 'Get overview of all concepts with relationship counts',
            inputSchema: {
              type: 'object',
              properties: {},
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
            name: 'read_concept',
            description: 'Read specific concept with full content',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'The name of the concept to read',
                },
              },
              required: ['name'],
              additionalProperties: false,
            },
          },
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
                  items: { type: 'string' },
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
            name: 'get_concept_relationships',
            description: 'Get relationships for a specific concept (linked notes, related concepts)',
            inputSchema: {
              type: 'object',
              properties: {
                conceptName: {
                  type: 'string',
                  description: 'The name of the concept',
                },
              },
              required: ['conceptName'],
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
            name: 'suggest_inbox_processing',
            description: 'AI-powered analysis of inbox ideas with specific processing recommendations. Returns actionable suggestions for promoting ideas to notes, extracting concepts, and identifying connections.',
            inputSchema: {
              type: 'object',
              properties: {},
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
                  items: { type: 'string' },
                  description: 'Additional concepts to tag this note with',
                },
                newLinks: {
                  type: 'array',
                  items: { type: 'string' },
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
                  items: { type: 'string' },
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
                  items: { type: 'string' },
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
                  items: { type: 'string' },
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
                  items: { type: 'string' },
                  description: 'Note filenames to unlink',
                },
              },
              required: ['filename', 'links'],
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
                  items: { type: 'string' },
                  description: 'Key concepts to tag this note with for knowledge graph connections',
                },
              },
              required: ['ideaFilename', 'title'],
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
                  items: { type: 'string' },
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
          },
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
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        if (!request || !request.params) {
          throw new Error('Invalid request: missing params');
        }
        
        const { name, arguments: args } = request.params;
        
        if (!name) {
          throw new Error('Invalid request: missing tool name');
        }
        switch (name) {
          case 'get_storage_config':
            return await this.getStorageConfig();

          case 'configure_notes_directory':
            return await this.configureNotesDirectory(args.path as string);

          case 'generate_mcp_configuration':
            return await this.generateMCPConfiguration();

          // Tools that require storage to be initialized
          case 'list_all_notes':
          case 'list_ideas':
          case 'list_inbox_notes':
          case 'list_all_concepts':
          case 'get_knowledge_stats':
          case 'read_note':
          case 'read_concept':
          case 'search_knowledge':
          case 'get_note_relationships':
          case 'get_concept_relationships':
          case 'analyze_note_content':
          case 'suggest_inbox_processing':
          case 'update_note_content':
          case 'update_note_metadata':
          case 'add_concepts_to_note':
          case 'remove_concepts_from_note':
          case 'add_links_to_note':
          case 'remove_links_from_note':
          case 'process_inbox_item':
          case 'merge_notes':
          case 'capture_idea':
          case 'promote_idea_to_note':
          case 'rename_note':
          case 'list_media_for_note':
          case 'save_media':
          case 'load_media':
          case 'delete_media':
          case 'get_recent_notes':
          case 'get_similar_notes':
            if (!this.notesStorage) {
              return this.createErrorResponse('Notes storage not initialized. Use configure_notes_directory to set up a notes directory first.');
            }
            break;
        }

        switch (name) {
          case 'list_all_notes':
            return await this.listAllNotes();

          case 'list_ideas':
            return await this.listIdeas();

          case 'list_inbox_notes':
            return await this.listInboxNotes();

          case 'list_all_concepts':
            return await this.listAllConcepts();

          case 'get_knowledge_stats':
            return await this.getKnowledgeStats();

          case 'read_note':
            return await this.readNote(args.filename as string);

          case 'read_concept':
            return await this.readConcept(args.name as string);

          case 'search_knowledge':
            return await this.searchKnowledge(args.query as string, {
              includeIdeas: args.includeIdeas,
              conceptFilter: args.conceptFilter,
              contextDepth: args.contextDepth,
            });

          case 'get_note_relationships':
            return await this.getNoteRelationships(args.filename as string);

          case 'get_concept_relationships':
            return await this.getConceptRelationships(args.conceptName as string);

          case 'analyze_note_content':
            return await this.analyzeNoteContent(args.content as string);

          case 'suggest_inbox_processing':
            return await this.suggestInboxProcessing();

          case 'update_note_content':
            return await this.updateNoteContent(args.filename as string, args.content as string);

          case 'update_note_metadata':
            return await this.updateNoteMetadata(args.filename as string, {
              title: args.title,
              concepts: args.concepts,
              links: args.links,
            });

          case 'add_concepts_to_note':
            return await this.addConceptsToNote(args.filename as string, args.concepts as string[]);

          case 'remove_concepts_from_note':
            return await this.removeConceptsFromNote(args.filename as string, args.concepts as string[]);

          case 'add_links_to_note':
            return await this.addLinksToNote(args.filename as string, args.links as string[]);

          case 'remove_links_from_note':
            return await this.removeLinksFromNote(args.filename as string, args.links as string[]);

          case 'process_inbox_item':
            return await this.processInboxItem(args.filename as string, {
              action: args.action as 'create_note' | 'merge_with_note' | 'delete',
              targetFilename: args.targetFilename,
              title: args.title,
              concepts: args.concepts,
              appendContent: args.appendContent !== false,
            });

          case 'merge_notes':
            return await this.mergeNotes(
              args.sourceFilenames as string[],
              args.targetFilename as string,
              {
                title: args.title,
                mergeStrategy: args.mergeStrategy as 'append' | 'sections' | 'chronological' || 'sections',
                deleteSource: args.deleteSource !== false,
              }
            );

          case 'capture_idea':
            return await this.captureIdea(args.content as string);

          case 'promote_idea_to_note':
            return await this.promoteIdeaToNote(
              args.ideaFilename as string,
              args.title as string,
              args.concepts as string[]
            );

          case 'rename_note':
            return await this.renameNote(args.oldFilename as string, args.newFilename as string);

          case 'list_media_for_note':
            return await this.listMediaForNote(args.noteFilename as string);

          case 'save_media':
            return await this.saveMedia(args.filename as string, args.data as string, args.mimeType as string);

          case 'load_media':
            return await this.loadMedia(args.filename as string);

          case 'delete_media':
            return await this.deleteMedia(args.filename as string);

          case 'get_recent_notes':
            return await this.getRecentNotes(args.limit as number);

          case 'get_similar_notes':
            return await this.getSimilarNotes(args.filename as string, args.limit as number);

          default:
            return this.createErrorResponse(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return this.createErrorResponse(`Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private async listAllNotes() {
    const notes = await this.notesStorage!.listNotes('all');
    
    // For many notes, return summary without previews for better performance
    if (notes.length > 20) {
      const noteSummaries = notes.map((note) => ({
        filename: note.filename,
        title: note.metadata.title,
        location: note.location,
        created: note.metadata.created,
        modified: note.metadata.modified,
        conceptCount: note.metadata.concepts?.length || 0,
        linkCount: note.metadata.links?.length || 0,
      }));
      
      return this.createSuccessResponse({
        count: notes.length,
        notes: noteSummaries,
        message: `Listed ${notes.length} notes (summaries only for performance). Use read_note to get full content.`
      });
    }
    
    // For fewer notes, include content previews
    const notesWithPreviews = await Promise.all(
      notes.map(async (note) => {
        const fullNote = await this.notesStorage!.loadNote(note.filename);
        const preview = fullNote.content.substring(0, 100).replace(/\n/g, ' ');
        return {
          filename: note.filename,
          title: note.metadata.title,
          location: note.location,
          metadata: note.metadata,
          preview: preview + (fullNote.content.length > 100 ? '...' : ''),
        };
      })
    );

    return this.createSuccessResponse(notesWithPreviews);
  }

  private async listIdeas() {
    const ideas = await this.notesStorage!.listIdeas();
    const result = {
      workflow_note: "These are raw captures that need review. Users should regularly process ideas by either: 1) Promoting to structured notes, 2) Adding concepts, or 3) Deleting if no longer relevant",
      ideas_count: ideas.length,
      items: ideas.map(idea => ({
        id: idea.id,
        filename: idea.filename,
        content: idea.content,
        created: idea.created,
        modified: idea.modified,
        metadata: idea.metadata
      }))
    };

    return this.createSuccessResponse(result);
  }

  private async listInboxNotes() {
    const notes = await this.notesStorage!.listNotes('inbox');
    const inboxNotesWithContent = await Promise.all(
      notes.map(async (note) => {
        const fullNote = await this.notesStorage!.loadNote(note.filename);
        const media = await this.notesStorage!.listMediaForNote(note.filename);
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

    return this.createSuccessResponse(result);
  }

  private async listAllConcepts() {
    const concepts = await this.notesStorage!.listConcepts();
    const conceptsWithCounts = concepts.map((concept) => {
      return {
        name: concept.name,
        linkedNotesCount: concept.metadata.linkedNotes?.length || 0,
        relatedConceptsCount: concept.metadata.relatedConcepts?.length || 0,
        created: concept.metadata.created,
        modified: concept.metadata.modified,
      };
    });

    return this.createSuccessResponse(conceptsWithCounts);
  }

  private async getKnowledgeStats() {
    const allNotes = await this.notesStorage!.listNotes('all');
    const inboxNotes = await this.notesStorage!.listNotes('inbox');
    const concepts = await this.notesStorage!.listConcepts();

    // Get recent activity (notes modified in last 7 days)
    const recentCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentActivity = allNotes
      .filter((note) => note.metadata.modified && new Date(note.metadata.modified) > recentCutoff)
      .slice(0, 10)
      .map((note) => ({
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

    return this.createSuccessResponse(stats);
  }

  private async readNote(filename: string) {
    const note = await this.notesStorage!.loadNote(filename);
    return this.createSuccessResponse(note);
  }

  private async readConcept(name: string) {
    const concept = await this.notesStorage!.getConcept(name);
    return this.createSuccessResponse(concept);
  }

  private async searchKnowledge(query: string, options: any = {}) {
    const searchOptions = {
      includeInbox: options.includeIdeas || false,
      concepts: options.conceptFilter || undefined,
      sortBy: 'modified' as const
    };
    
    const noteResults = await this.notesStorage!.searchNotes(query, searchOptions);
    
    // Get preview length based on context depth
    const previewLength = options.contextDepth === 'full' ? 500 : 
                         options.contextDepth === 'summary' ? 50 : 150;
    
    const response = {
      query: query,
      totalResults: noteResults.length,
      contextDepth: options.contextDepth || 'detailed',
      aiGuidance: `Found ${noteResults.length} results. Use 'read_note' for full content, 'get_note_relationships' to explore connections, or 'capture_idea' to add related thoughts.`,
      results: noteResults.map(note => ({
        filename: note.filename,
        title: note.metadata.title,
        location: note.location,
        preview: note.content.substring(0, previewLength).replace(/\n/g, ' ') + (note.content.length > previewLength ? '...' : ''),
        concepts: note.metadata.concepts || [],
        conceptCount: note.metadata.concepts?.length || 0,
        lastModified: note.metadata.modified,
        relevanceIndicators: {
          hasMatchingConcepts: options.conceptFilter ? 
            note.metadata.concepts?.some(c => options.conceptFilter.includes(c)) : false,
          isRecentlyModified: note.metadata.modified ? 
            (new Date().getTime() - new Date(note.metadata.modified).getTime()) < (7 * 24 * 60 * 60 * 1000) : false
        }
      }))
    };
    
    return this.createSuccessResponse(response);
  }

  private async getNoteRelationships(filename: string) {
    const note = await this.notesStorage!.loadNote(filename);
    
    // Get backlinks by searching for references to this note
    const allNotes = await this.notesStorage!.listNotes('all');
    const backlinks: string[] = [];
    
    for (const otherNote of allNotes) {
      if (otherNote.filename === filename) continue;
      const fullNote = await this.notesStorage!.loadNote(otherNote.filename);
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

    return this.createSuccessResponse(relationships);
  }

  private async getConceptRelationships(conceptName: string) {
    const concept = await this.notesStorage!.getConcept(conceptName);
    const linkedNotes = await this.notesStorage!.getNotesForConcept(conceptName);
    
    // Get concepts that co-occur in linked notes
    const conceptsInLinkedNotes: string[] = [];
    for (const noteFilename of linkedNotes) {
      const note = await this.notesStorage!.loadNote(noteFilename);
      if (note.metadata.concepts) {
        conceptsInLinkedNotes.push(...note.metadata.concepts.filter(c => c !== conceptName));
      }
    }

    const relationships = {
      linkedNotes,
      relatedConcepts: concept.metadata.relatedConcepts || [],
      conceptsInLinkedNotes: [...new Set(conceptsInLinkedNotes)], // dedupe
    };

    return this.createSuccessResponse(relationships);
  }

  private async analyzeNoteContent(content: string) {
    const parsed = this.notesStorage!.parseContent(content);
    return this.createSuccessResponse(parsed);
  }

  private async suggestInboxProcessing() {
    const inboxNotes = await this.notesStorage!.listNotes('inbox');
    
    if (inboxNotes.length === 0) {
      return this.createSuccessResponse({
        workflow_guidance: "Inbox is clean! Use the inbox for quick captures of ideas and thoughts.",
        total_inbox_items: 0,
        processing_suggestions: []
      });
    }
    
    // Limit processing to avoid performance issues
    const maxInboxItems = 10;
    const itemsToProcess = inboxNotes.slice(0, maxInboxItems);
    
    // Get all notes metadata (without full content) for performance
    const allNotes = await this.notesStorage!.listNotes('notes');
    const allConceptNames = (await this.notesStorage!.listConcepts()).map(c => c.name);
    
    const suggestions = [];
    
    for (const inboxNote of itemsToProcess) {
      const fullNote = await this.notesStorage!.loadNote(inboxNote.filename);
      const parsed = this.notesStorage!.parseContent(fullNote.content);
      
      // Find existing notes that share concepts (using metadata only)
      const potentialMatches = [];
      for (const note of allNotes) {
        const noteConcepts = note.metadata.concepts || [];
        const overlap = parsed.concepts.filter(c => noteConcepts.includes(c));
        if (overlap.length > 0) {
          potentialMatches.push({
            filename: note.filename,
            title: note.metadata.title,
            sharedConcepts: overlap,
            score: overlap.length
          });
        }
      }
      
      // Sort by number of shared concepts and take top 3
      potentialMatches.sort((a, b) => b.score - a.score);
      
      // Check for new concepts
      const newConcepts = parsed.concepts.filter(c => !allConceptNames.includes(c));
      
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
        `Showing suggestions for first ${maxInboxItems} items (of ${inboxNotes.length} total) for performance.` : 
        undefined
    };

    return this.createSuccessResponse(result);
  }

  private async getStorageConfig() {
    const notesDirectory = this.store.get('notesDirectory') as string | undefined;
    const config = {
      notesDirectory: notesDirectory || null,
      initialized: !!notesDirectory && !!this.notesStorage,
      status: notesDirectory 
        ? (this.notesStorage ? 'ready' : 'directory_set_but_not_initialized')
        : 'not_configured'
    };

    return this.createSuccessResponse(config);
  }

  private async configureNotesDirectory(path: string) {
    try {
      // Validate that the path exists and is accessible
      const fs = require('fs').promises;
      await fs.access(path);
      
      // Store the path
      this.store.set('notesDirectory', path);
      
      // Initialize storage with the new path
      this.notesStorage = new NotesStorage(path);
      await this.notesStorage.initialize();
      
      return {
        content: [
          {
            type: 'text',
            text: `Successfully configured notes directory: ${path}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error configuring notes directory: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async generateMCPConfiguration() {
    try {
      const appPath = app.getPath('exe');
      const configPath = this.getClaudeDesktopConfigPath();
      
      // Check if we're in development (Electron binary) or production (app bundle)
      const isDev = appPath.includes('node_modules') || appPath.includes('Electron.app');
      
      let mcpConfig;
      if (isDev) {
        // Development: Use electron command with the built main file and --mcp flag
        const mainPath = path.join(__dirname, 'index.js');
        mcpConfig = {
          mcpServers: {
            "notes-app": {
              command: appPath,
              args: [mainPath, "--mcp"],
              description: "Personal notes management with AI-powered search and analysis (Development)"
            }
          }
        };
      } else {
        // Production: Use the app bundle with --mcp flag
        mcpConfig = {
          mcpServers: {
            "notes-app": {
              command: appPath,
              args: ["--mcp"],
              description: "Personal notes management with AI-powered search and analysis"
            }
          }
        };
      }

      const configText = JSON.stringify(mcpConfig, null, 2);
      
      return {
        content: [
          {
            type: 'text',
            text: `Claude Desktop MCP Configuration Generated:

File location: ${configPath}

Configuration to add/merge:
${configText}

Instructions:
1. Open or create the Claude Desktop configuration file at the path above
2. If the file exists, merge the "notes-app" entry into the existing "mcpServers" object
3. If the file doesn't exist, create it with the full configuration above
4. Restart Claude Desktop to load the new MCP server

The app executable is located at: ${appPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating MCP configuration: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private getClaudeDesktopConfigPath(): string {
    const platform = process.platform;
    const homeDir = os.homedir();
    
    switch (platform) {
      case 'darwin': // macOS
        return path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
      case 'win32': // Windows
        return path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
      case 'linux': // Linux
        return path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json');
      default:
        return path.join(homeDir, '.claude_desktop_config.json');
    }
  }

  private async updateNoteContent(filename: string, content: string) {
    const note = await this.notesStorage!.loadNote(filename);
    await this.notesStorage!.saveNote(filename, content, {
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

  private async updateNoteMetadata(filename: string, updates: { title?: string; concepts?: string[]; links?: string[] }) {
    const note = await this.notesStorage!.loadNote(filename);
    const metadata = { ...note.metadata };
    
    if (updates.title !== undefined) metadata.title = updates.title;
    if (updates.concepts !== undefined) metadata.concepts = updates.concepts;
    if (updates.links !== undefined) metadata.links = updates.links;
    
    metadata.modified = new Date().toISOString();
    
    await this.notesStorage!.saveNote(filename, note.content, metadata);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated metadata for ${filename}`,
        },
      ],
    };
  }

  private async addConceptsToNote(filename: string, conceptsToAdd: string[]) {
    const note = await this.notesStorage!.loadNote(filename);
    const existingConcepts = note.metadata.concepts || [];
    const newConcepts = [...new Set([...existingConcepts, ...conceptsToAdd])];
    
    await this.notesStorage!.saveNote(filename, note.content, {
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

  private async removeConceptsFromNote(filename: string, conceptsToRemove: string[]) {
    const note = await this.notesStorage!.loadNote(filename);
    const existingConcepts = note.metadata.concepts || [];
    const newConcepts = existingConcepts.filter(c => !conceptsToRemove.includes(c));
    
    await this.notesStorage!.saveNote(filename, note.content, {
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

  private async addLinksToNote(filename: string, linksToAdd: string[]) {
    const note = await this.notesStorage!.loadNote(filename);
    const existingLinks = note.metadata.links || [];
    const newLinks = [...new Set([...existingLinks, ...linksToAdd])];
    
    await this.notesStorage!.saveNote(filename, note.content, {
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

  private async removeLinksFromNote(filename: string, linksToRemove: string[]) {
    const note = await this.notesStorage!.loadNote(filename);
    const existingLinks = note.metadata.links || [];
    const newLinks = existingLinks.filter(l => !linksToRemove.includes(l));
    
    await this.notesStorage!.saveNote(filename, note.content, {
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

  private async processInboxItem(filename: string, options: {
    action: 'create_note' | 'merge_with_note' | 'delete';
    targetFilename?: string;
    title?: string;
    concepts?: string[];
    appendContent?: boolean;
  }) {
    const inboxNote = await this.notesStorage!.loadNote(filename);
    
    switch (options.action) {
      case 'create_note':
        if (!options.targetFilename) {
          throw new Error('targetFilename required for create_note action');
        }
        
        // Create new note in main directory and delete from inbox
        await this.notesStorage!.saveNote(options.targetFilename, inboxNote.content, inboxNote.metadata, 'notes');
        await this.notesStorage!.deleteNote(filename);
        
        // Update metadata
        if (options.title || options.concepts) {
          const metadata = {
            ...inboxNote.metadata,
            title: options.title || inboxNote.metadata.title,
            concepts: options.concepts || inboxNote.metadata.concepts,
            modified: new Date().toISOString()
          };
          await this.notesStorage!.saveNote(options.targetFilename, inboxNote.content, metadata);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: `Moved inbox item to ${options.targetFilename}`,
            },
          ],
        };
        
      case 'merge_with_note':
        if (!options.targetFilename) {
          throw new Error('targetFilename required for merge_with_note action');
        }
        
        const targetNote = await this.notesStorage!.loadNote(options.targetFilename);
        const newContent = options.appendContent 
          ? `${targetNote.content}\n\n${inboxNote.content}`
          : `${inboxNote.content}\n\n${targetNote.content}`;
        
        // Merge concepts
        const mergedConcepts = options.concepts || targetNote.metadata.concepts || [];
        if (inboxNote.metadata.concepts) {
          mergedConcepts.push(...inboxNote.metadata.concepts);
        }
        
        await this.notesStorage!.saveNote(options.targetFilename, newContent, {
          ...targetNote.metadata,
          title: options.title || targetNote.metadata.title,
          concepts: [...new Set(mergedConcepts)],
          modified: new Date().toISOString()
        });
        
        // Delete inbox item
        await this.notesStorage!.deleteNote(filename);
        
        return {
          content: [
            {
              type: 'text',
              text: `Merged inbox item into ${options.targetFilename}`,
            },
          ],
        };
        
      case 'delete':
        await this.notesStorage!.deleteNote(filename);
        return {
          content: [
            {
              type: 'text',
              text: `Deleted inbox item ${filename}`,
            },
          ],
        };
    }
  }

  private async mergeNotes(sourceFilenames: string[], targetFilename: string, options: {
    title?: string;
    mergeStrategy: 'append' | 'sections' | 'chronological';
    deleteSource: boolean;
  }) {
    const sourceNotes = await Promise.all(
      sourceFilenames.map(filename => this.notesStorage!.loadNote(filename))
    );
    
    // Check if target exists
    let targetNote;
    let targetExists = false;
    try {
      targetNote = await this.notesStorage!.loadNote(targetFilename);
      targetExists = true;
    } catch {
      // Target doesn't exist, will create new
    }
    
    // Sort notes if chronological
    if (options.mergeStrategy === 'chronological') {
      sourceNotes.sort((a, b) => 
        new Date(a.metadata.created || 0).getTime() - new Date(b.metadata.created || 0).getTime()
      );
    }
    
    // Build merged content
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
    
    // Merge metadata
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
    
    // Save merged note
    await this.notesStorage!.saveNote(targetFilename, mergedContent, metadata);
    
    // Delete source notes if requested
    if (options.deleteSource) {
      for (const filename of sourceFilenames) {
        await this.notesStorage!.deleteNote(filename);
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

  private async captureIdea(content: string) {
    const idea = await this.notesStorage!.createIdea(content);
    
    return {
      content: [
        {
          type: 'text',
          text: `💡 Captured idea: ${idea.filename}\n\nNext steps: Use 'promote_idea_to_note' to transform this into a structured note with title and concepts.`,
        },
      ],
    };
  }

  private async promoteIdeaToNote(ideaFilename: string, title: string, concepts?: string[]) {
    const note = await this.notesStorage!.promoteIdeaToNote(ideaFilename, title, concepts);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Promoted idea to structured note: ${note.filename}\n\nConcepts: ${concepts?.join(', ') || 'none'}\nThe idea has been moved from inbox to your knowledge base.`,
        },
      ],
    };
  }

  private async renameNote(oldFilename: string, newFilename: string) {
    await this.notesStorage!.renameNote(oldFilename, newFilename);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully renamed ${oldFilename} to ${newFilename}`,
        },
      ],
    };
  }

  private async listMediaForNote(noteFilename: string) {
    const mediaFiles = await this.notesStorage!.listMediaForNote(noteFilename);
    return this.createSuccessResponse(mediaFiles);
  }

  private async saveMedia(filename: string, data: string, mimeType: string) {
    await this.notesStorage!.saveMedia(filename, data, mimeType);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully saved media file: ${filename}`,
        },
      ],
    };
  }

  private async loadMedia(filename: string) {
    const media = await this.notesStorage!.loadMedia(filename);
    return this.createSuccessResponse(media);
  }

  private async deleteMedia(filename: string) {
    await this.notesStorage!.deleteMedia(filename);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully deleted media file: ${filename}`,
        },
      ],
    };
  }

  private async getRecentNotes(limit: number = 5) {
    const recentNotes = await this.notesStorage!.getRecentNotes(limit);
    return this.createSuccessResponse(recentNotes);
  }

  private async getSimilarNotes(filename: string, limit: number = 5) {
    // Load the target note to get its concepts
    const note = await this.notesStorage!.loadNote(filename);
    const concepts = note.metadata.concepts || [];
    
    if (concepts.length === 0) {
      return this.createSuccessResponse([]);
    }
    
    // Get all notes and find those with similar concepts
    const allNotes = await this.notesStorage!.listNotes('notes');
    const similar = allNotes.filter((n) => {
      if (n.filename === filename) return false;
      const noteConcepts = n.metadata.concepts || [];
      return concepts.some((c: string) => noteConcepts.includes(c));
    });
    
    // Sort by number of shared concepts and take the limit
    const similarWithScore = similar.map((n) => {
      const noteConcepts = n.metadata.concepts || [];
      const sharedConcepts = concepts.filter((c: string) => noteConcepts.includes(c));
      return {
        ...n,
        sharedConceptsCount: sharedConcepts.length,
        sharedConcepts
      };
    });
    
    similarWithScore.sort((a, b) => b.sharedConceptsCount - a.sharedConceptsCount);
    
    return this.createSuccessResponse(similarWithScore.slice(0, limit));
  }

  async start() {
    try {
      const transport = new StdioServerTransport();
      
      // Add error handling for transport
      transport.onError = (error: any) => {
        console.error('MCP Transport error:', error);
      };
      
      await this.server.connect(transport);
      
      // Add error handling for the server
      this.server.onError = (error: any) => {
        console.error('MCP Server error:', error);
      };
      
      console.error('Notes MCP Server started on stdio');
    } catch (error) {
      console.error('Failed to start MCP server:', error);
      throw error;
    }
  }
}