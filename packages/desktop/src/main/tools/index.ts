import { ToolDefinition } from './types';
import { configTools } from './config-tools';
import { noteTools } from './note-tools';
import { conceptTools } from './concept-tools';
import { inboxTools } from './inbox-tools';
import { searchTools } from './search-tools';
import { mediaTools } from './media-tools';
import type { NotesStorage, CreateSuccessResponse, ToolLogicFn } from './types';
import {
  getStorageConfig,
  configureNotesDirectory,
  generateMCPConfiguration
} from './config-tools';
import {
  listAllNotes,
  readNote,
  getNoteRelationships,
  enrichNote,
  mergeNotes,
  renameNote,
  addConceptsToNote,
  removeConceptsFromNote,
  addLinksToNote,
  removeLinksFromNote,
  updateNoteContent,
  updateNoteMetadata
} from './note-tools';
import {
  listAllConcepts,
  readConcept,
  getConceptRelationships
} from './concept-tools';
import {
  captureIdea,
  listInboxNotes,
  suggestInboxProcessing,
  processInboxItem,
  promoteIdeaToNote
} from './inbox-tools';
import {
  listMediaForNote,
  saveMedia,
  loadMedia,
  deleteMedia
} from './media-tools';
import {
  searchKnowledge,
  getKnowledgeStats,
  analyzeNoteContent,
  getRecentNotes,
  getSimilarNotes
} from './search-tools';

export * from './types';

/**
 * All available MCP tools organized by category
 */
export const toolCategories = {
  configuration: {
    name: 'Configuration',
    description: 'Setup and configuration management',
    tools: configTools,
  },
  notes: {
    name: 'Notes',
    description: 'Core note management and editing',
    tools: noteTools,
  },
  concepts: {
    name: 'Concepts',
    description: 'Knowledge graph and concept management',
    tools: conceptTools,
  },
  inbox: {
    name: 'Inbox',
    description: 'Idea capture and processing workflow',
    tools: inboxTools,
  },
  search: {
    name: 'Search',
    description: 'Knowledge discovery and analysis',
    tools: searchTools,
  },
  media: {
    name: 'Media',
    description: 'Attachment and media file management',
    tools: mediaTools,
  }
};

/**
 * Flattened array of all tools for MCP server registration
 */
export const allTools: ToolDefinition[] = Object.values(toolCategories)
  .flatMap(category => category.tools);

/**
 * Tool lookup map for quick access by name
 */
export const toolMap = new Map<string, ToolDefinition>(
  allTools.map(tool => [tool.name, tool])
);

/**
 * Enhanced error messages with tool suggestions
 */
export function getEnhancedErrorMessage(toolName: string, error: string): string {
  const tool = toolMap.get(toolName);

  if (!tool) {
    const availableTools = allTools.map(t => t.name).join(', ');
    return `Tool '${toolName}' not found. Available tools: ${availableTools}`;
  }

  // Common error patterns with helpful suggestions
  const errorPatterns = [
    {
      pattern: /required.*filename/i,
      suggestion: `Tool '${toolName}' requires a 'filename' parameter. Example: {"filename": "my-note.txt"}`,
    },
    {
      pattern: /required.*path/i,
      suggestion: `Tool '${toolName}' requires a 'path' parameter. Example: {"path": "/Users/username/Documents/notes"}`,
    },
    {
      pattern: /required.*content/i,
      suggestion: `Tool '${toolName}' requires a 'content' parameter. Example: {"content": "Your idea or note content here"}`,
    },
    {
      pattern: /required.*query/i,
      suggestion: `Tool '${toolName}' requires a 'query' parameter. Example: {"query": "productivity systems"}`,
    },
    {
      pattern: /not found|does not exist/i,
      suggestion: `The requested resource was not found. Use 'list_all_notes' or 'list_all_concepts' to see available items.`,
    },
    {
      pattern: /not configured|not initialized/i,
      suggestion: `Notes storage not configured. Use 'configure_notes_directory' to set up your notes directory first.`,
    },
  ];

  for (const pattern of errorPatterns) {
    if (pattern.pattern.test(error)) {
      return `${error}\n\nSuggestion: ${pattern.suggestion}`;
    }
  }

  // Default enhanced error with tool description
  return `${error}\n\nTool description: ${tool.description}`;
}

/**
 * Get tools by category for organized display
 */
export function getToolsByCategory(categoryName: string): ToolDefinition[] {
  const category = toolCategories[categoryName as keyof typeof toolCategories];
  return category ? category.tools : [];
}

/**
 * Search tools by name or description
 */
export function findTools(query: string): ToolDefinition[] {
  const lowerQuery = query.toLowerCase();
  return allTools.filter(tool =>
    tool.name.toLowerCase().includes(lowerQuery) ||
    (tool.description && tool.description.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Tool logic registry: maps tool name to implementation
 */
export const toolLogicRegistry: Record<string, ToolLogicFn> = {
  // Config
  get_storage_config: getStorageConfig,
  configure_notes_directory: configureNotesDirectory,
  generate_mcp_configuration: generateMCPConfiguration,
  // Notes
  list_all_notes: listAllNotes,
  read_note: readNote,
  get_note_relationships: getNoteRelationships,
  enrich_note: enrichNote,
  merge_notes: mergeNotes,
  rename_note: renameNote,
  update_note_content: updateNoteContent,
  update_note_metadata: updateNoteMetadata,
  add_concepts_to_note: addConceptsToNote,
  remove_concepts_from_note: removeConceptsFromNote,
  add_links_to_note: addLinksToNote,
  remove_links_from_note: removeLinksFromNote,
  // Concepts
  list_all_concepts: listAllConcepts,
  read_concept: readConcept,
  get_concept_relationships: getConceptRelationships,
  // Inbox
  capture_idea: captureIdea,
  list_inbox_notes: listInboxNotes,
  suggest_inbox_processing: suggestInboxProcessing,
  process_inbox_item: processInboxItem,
  promote_idea_to_note: promoteIdeaToNote,
  // Media
  list_media_for_note: listMediaForNote,
  save_media: saveMedia,
  load_media: loadMedia,
  delete_media: deleteMedia,
  // Search
  search_knowledge: searchKnowledge,
  get_knowledge_stats: getKnowledgeStats,
  analyze_note_content: analyzeNoteContent,
  get_recent_notes: getRecentNotes,
  get_similar_notes: getSimilarNotes,
};