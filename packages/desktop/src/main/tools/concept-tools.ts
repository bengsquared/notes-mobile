import { ToolDefinition } from './types';
import type { NotesStorage, CreateSuccessResponse } from './types';

/**
 * Concept management and knowledge graph tools
 * 
 * Example usage:
 * - list_all_concepts: Get overview of all concepts with relationship counts
 * - read_concept: Read full definition of "#productivity" concept
 * - get_concept_relationships: Find all notes tagged with "#ai-tools" concept
 */
export const conceptTools: ToolDefinition[] = [
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
  }
];

// Tool logic implementations
export async function listAllConcepts(notesStorage: NotesStorage, createSuccessResponse: CreateSuccessResponse) {
  const concepts = await notesStorage.listConcepts();
  const conceptsWithCounts = concepts.map((concept: any) => ({
    name: concept.name,
    linkedNotesCount: concept.metadata.linkedNotes?.length || 0,
    relatedConceptsCount: concept.metadata.relatedConcepts?.length || 0,
    created: concept.metadata.created,
    modified: concept.metadata.modified,
  }));
  return createSuccessResponse(conceptsWithCounts);
}

export async function readConcept(notesStorage: NotesStorage, name: string, createSuccessResponse: CreateSuccessResponse) {
  const concept = await notesStorage.getConcept(name);
  return createSuccessResponse(concept);
}

export async function getConceptRelationships(notesStorage: NotesStorage, conceptName: string, createSuccessResponse: CreateSuccessResponse) {
  const concept = await notesStorage.getConcept(conceptName);
  const linkedNotes = await notesStorage.getNotesForConcept(conceptName);
  // Get concepts that co-occur in linked notes
  const conceptsInLinkedNotes: string[] = [];
  for (const noteFilename of linkedNotes) {
    const note = await notesStorage.loadNote(noteFilename);
    if (note.metadata.concepts) {
      conceptsInLinkedNotes.push(...note.metadata.concepts.filter((c: string) => c !== conceptName));
    }
  }
  const relationships = {
    linkedNotes,
    relatedConcepts: concept.metadata.relatedConcepts || [],
    conceptsInLinkedNotes: [...new Set(conceptsInLinkedNotes)],
  };
  return createSuccessResponse(relationships);
}