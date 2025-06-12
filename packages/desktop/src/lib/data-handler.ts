/**
 * Universal Data Handler
 * 
 * Provides a consistent, type-safe interface for frontend components to interact
 * with the backend storage system. This handler abstracts the complexity of the
 * IPC layer and provides convenient methods for common operations.
 */

import type { 
  Note, 
  Concept, 
  MediaFile, 
  SearchOptions, 
  ParsedContent, 
  NoteMetadata,
  ConceptMetadata
} from '@notes-app/shared';
import type { Idea } from './storage';

// Ensure we're in a renderer process with access to electronAPI
declare global {
  interface Window {
    electronAPI: any;
  }
}

export class UniversalDataHandler {
  private api = window.electronAPI;

  // ============================================================================
  // IDEAS OPERATIONS
  // ============================================================================

  async listIdeas(): Promise<Idea[]> {
    return this.api.ideas.list();
  }

  async createIdea(content: string, metadata?: Partial<NoteMetadata>): Promise<Idea> {
    return this.api.ideas.create(content, metadata);
  }

  async loadIdea(filename: string): Promise<Idea> {
    return this.api.ideas.load(filename);
  }

  async updateIdea(filename: string, content: string, metadata?: Partial<NoteMetadata>): Promise<Idea> {
    return this.api.ideas.update(filename, content, metadata);
  }

  async deleteIdea(filename: string): Promise<void> {
    return this.api.ideas.delete(filename);
  }

  async renameIdea(oldFilename: string, newFilename: string): Promise<boolean> {
    return this.api.ideas.rename(oldFilename, newFilename);
  }

  async promoteIdea(ideaFilename: string, title: string, concepts?: string[]): Promise<Note> {
    return this.api.ideas.promote(ideaFilename, title, concepts);
  }

  // Idea metadata operations for unified context
  async attachConceptToIdea(filename: string, conceptName: string): Promise<void> {
    return this.api.ideas.attachConcept(filename, conceptName);
  }

  async removeConceptFromIdea(filename: string, conceptName: string): Promise<void> {
    return this.api.ideas.removeConcept(filename, conceptName);
  }

  async linkNoteToIdea(ideaFilename: string, noteFilename: string): Promise<void> {
    return this.api.ideas.linkNote(ideaFilename, noteFilename);
  }

  async removeNoteLinkFromIdea(ideaFilename: string, noteFilename: string): Promise<void> {
    return this.api.ideas.removeNoteLink(ideaFilename, noteFilename);
  }

  async updateIdeaMetadata(filename: string, metadata: Partial<NoteMetadata>): Promise<void> {
    return this.api.ideas.updateMetadata(filename, metadata);
  }

  // ============================================================================
  // NOTES OPERATIONS
  // ============================================================================

  async listNotes(): Promise<Note[]> {
    return this.api.notes.list();
  }

  async loadNote(filename: string): Promise<Note> {
    return this.api.notes.load(filename);
  }

  async saveNote(filename: string, content: string, metadata: NoteMetadata): Promise<boolean> {
    return this.api.notes.save(filename, content, metadata);
  }

  async deleteNote(filename: string): Promise<boolean> {
    return this.api.notes.delete(filename);
  }

  async renameNote(oldFilename: string, newFilename: string): Promise<boolean> {
    return this.api.notes.rename(oldFilename, newFilename);
  }

  // ============================================================================
  // CONCEPTS OPERATIONS
  // ============================================================================

  async listConcepts(): Promise<Concept[]> {
    return this.api.concepts.list();
  }

  async createConcept(name: string, content: string, metadata?: ConceptMetadata): Promise<boolean> {
    return this.api.concepts.create(name, content, metadata);
  }

  async loadConcept(name: string): Promise<Concept> {
    console.log(`📡 DataHandler.loadConcept - Loading concept: ${name}`);
    const concept = await this.api.concepts.load(name);
    console.log(`📡 DataHandler.loadConcept - Received concept:`, concept);
    console.log(`📡 DataHandler.loadConcept - Concept metadata:`, concept.metadata);
    console.log(`📡 DataHandler.loadConcept - relatedConcepts:`, concept.metadata.relatedConcepts);
    return concept;
  }

  async saveConcept(name: string, content: string, metadata: ConceptMetadata): Promise<boolean> {
    return this.api.concepts.save(name, content, metadata);
  }

  async deleteConcept(name: string): Promise<boolean> {
    return this.api.concepts.delete(name);
  }

  async getNotesForConcept(conceptName: string): Promise<string[]> {
    return this.api.concepts.getNotesFor(conceptName);
  }

  async getConceptsForNote(filename: string): Promise<string[]> {
    return this.api.concepts.getForNote(filename);
  }

  // ============================================================================
  // MEDIA OPERATIONS
  // ============================================================================

  async saveMedia(filename: string, data: string | Buffer, mimeType?: string, noteFilename?: string): Promise<string> {
    return this.api.media.save(filename, data, mimeType, noteFilename);
  }

  async loadMedia(filename: string): Promise<{ data: string; mimeType: string }> {
    return this.api.media.load(filename);
  }

  async listMediaForNote(noteFilename: string): Promise<MediaFile[]> {
    return this.api.media.listForNote(noteFilename);
  }

  async deleteMedia(filename: string): Promise<boolean> {
    return this.api.media.delete(filename);
  }

  async listAllMedia(): Promise<MediaFile[]> {
    return this.api.media.listAll();
  }

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  async searchAll(query: string): Promise<{
    ideas: Idea[];
    notes: Note[];
    concepts: Concept[];
  }> {
    return this.api.search.all(query);
  }

  async searchNotes(query: string, options?: SearchOptions): Promise<Note[]> {
    return this.api.search.notes(query, options);
  }

  async suggestConcepts(noteContent: string): Promise<string[]> {
    return this.api.search.suggestConcepts(noteContent);
  }

  async findSimilarNotes(filename: string): Promise<Note[]> {
    return this.api.search.similarNotes(filename);
  }

  // ============================================================================
  // CONTENT OPERATIONS
  // ============================================================================

  async parseContent(content: string): Promise<ParsedContent> {
    return this.api.content.parse(content);
  }

  // ============================================================================
  // FILE MANAGEMENT
  // ============================================================================

  async checkFilenameUnique(filename: string, excludeFilename?: string): Promise<boolean> {
    return this.api.files.checkUnique(filename, excludeFilename);
  }

  async fileExists(filename: string): Promise<boolean> {
    return this.api.files.exists(filename);
  }

  // ============================================================================
  // RELATION MANAGEMENT
  // ============================================================================

  async addNoteConcept(noteFilename: string, conceptName: string): Promise<void> {
    console.log("in data-handler");
    return this.api.relations.addNoteConcept(noteFilename, conceptName);
  }

  async removeNoteConcept(noteFilename: string, conceptName: string): Promise<void> {
    return this.api.relations.removeNoteConcept(noteFilename, conceptName);
  }

  async updateNoteConcepts(noteFilename: string, oldConcepts: string[], newConcepts: string[]): Promise<void> {
    return this.api.relations.updateNoteConcepts(noteFilename, oldConcepts, newConcepts);
  }

  // Note-to-Note relations
  async addNoteLink(fromNote: string, toNote: string): Promise<void> {
    return this.api.relations.addNoteLink(fromNote, toNote);
  }

  async removeNoteLink(fromNote: string, toNote: string): Promise<void> {
    return this.api.relations.removeNoteLink(fromNote, toNote);
  }

  async updateNoteLinks(noteFilename: string, oldLinks: string[], newLinks: string[]): Promise<void> {
    return this.api.relations.updateNoteLinks(noteFilename, oldLinks, newLinks);
  }

  // Concept-to-Concept relations
  async addConceptRelation(fromConcept: string, toConcept: string): Promise<void> {
    return this.api.relations.addConceptRelation(fromConcept, toConcept);
  }

  async removeConceptRelation(fromConcept: string, toConcept: string): Promise<void> {
    return this.api.relations.removeConceptRelation(fromConcept, toConcept);
  }

  async updateConceptRelations(conceptName: string, oldRelated: string[], newRelated: string[]): Promise<void> {
    return this.api.relations.updateConceptRelations(conceptName, oldRelated, newRelated);
  }

  // Integrity validation and repair
  async validateIntegrity(): Promise<any> {
    return this.api.relations.validateIntegrity();
  }

  async repairIntegrity(): Promise<any> {
    return this.api.relations.repairIntegrity();
  }

  // Test rapid operations
  async testRapidOperations(noteFilename: string, concepts: string[]): Promise<string[]> {
    const results: string[] = [];
    
    // Rapid add/remove operations
    for (let i = 0; i < concepts.length; i++) {
      const concept = concepts[i];
      try {
        await this.addNoteConcept(noteFilename, concept);
        results.push(`Added: ${concept}`);
        await this.removeNoteConcept(noteFilename, concept);
        results.push(`Removed: ${concept}`);
      } catch (error) {
        results.push(`Error with ${concept}: ${error}`);
      }
    }
    
    return results;
  }

  // ============================================================================
  // INTEGRITY OPERATIONS
  // ============================================================================

  // ============================================================================
  // APP STATE MANAGEMENT
  // ============================================================================

  async getPinnedItems(): Promise<{ notes: string[]; concepts: string[] }> {
    return this.api.app.getPinnedItems();
  }

  async pinItem(type: 'note' | 'concept', name: string): Promise<boolean> {
    return this.api.app.pinItem(type, name);
  }

  async unpinItem(type: 'note' | 'concept', name: string): Promise<boolean> {
    return this.api.app.unpinItem(type, name);
  }

  async getRecentNotes(limit?: number): Promise<Note[]> {
    return this.api.app.getRecentNotes(limit);
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Get a complete overview of the knowledge base
   */
  async getKnowledgeOverview(): Promise<{
    stats: {
      totalNotes: number;
      totalIdeas: number;
      totalConcepts: number;
      totalMedia: number;
    };
    recentNotes: Note[];
    pinnedItems: { notes: string[]; concepts: string[] };
  }> {
    const [notes, ideas, concepts, media, recentNotes, pinnedItems] = await Promise.all([
      this.listNotes(),
      this.listIdeas(),
      this.listConcepts(),
      this.listAllMedia(),
      this.getRecentNotes(5),
      this.getPinnedItems()
    ]);

    return {
      stats: {
        totalNotes: notes.length,
        totalIdeas: ideas.length,
        totalConcepts: concepts.length,
        totalMedia: media.length
      },
      recentNotes,
      pinnedItems
    };
  }

  /**
   * Get all relationships for a specific note
   */
  async getNoteRelationships(filename: string): Promise<{
    concepts: string[];
    linkedNotes: string[];
    backlinks: Note[];
    media: MediaFile[];
  }> {
    const [note, concepts, media, allNotes] = await Promise.all([
      this.loadNote(filename),
      this.getConceptsForNote(filename),
      this.listMediaForNote(filename),
      this.listNotes()
    ]);

    // Find backlinks (notes that reference this note)
    const backlinks = allNotes.filter(n => 
      n.filename !== filename && 
      (n.metadata.links?.includes(filename) || n.content.includes(filename))
    );

    return {
      concepts,
      linkedNotes: note.metadata.links || [],
      backlinks,
      media
    };
  }

  /**
   * Get all relationships for a specific concept
   */
  async getConceptRelationships(conceptName: string): Promise<{
    linkedNotes: Note[];
    relatedConcepts: string[];
    coOccurringConcepts: string[];
  }> {
    const [concept, linkedNoteNames] = await Promise.all([
      this.loadConcept(conceptName),
      this.getNotesForConcept(conceptName)
    ]);

    // Load full note objects
    const linkedNotes = await Promise.all(
      linkedNoteNames.map(filename => this.loadNote(filename))
    );

    // Find concepts that co-occur in the same notes
    const coOccurringConcepts = new Set<string>();
    for (const note of linkedNotes) {
      for (const c of note.metadata.concepts || []) {
        if (c !== conceptName) {
          coOccurringConcepts.add(c);
        }
      }
    }

    return {
      linkedNotes,
      relatedConcepts: concept.metadata.relatedConcepts || [],
      coOccurringConcepts: Array.from(coOccurringConcepts)
    };
  }

  /**
   * Process multiple inbox items at once
   */
  async processInboxBatch(operations: Array<{
    filename: string;
    action: 'promote' | 'delete';
    title?: string;
    concepts?: string[];
  }>): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    for (const op of operations) {
      try {
        if (op.action === 'promote') {
          await this.promoteIdea(op.filename, op.title || 'Untitled', op.concepts);
        } else if (op.action === 'delete') {
          await this.deleteIdea(op.filename);
        }
        processed++;
      } catch (error) {
        errors.push(`Failed to ${op.action} ${op.filename}: ${error}`);
      }
    }

    return { processed, errors };
  }

  /**
   * Smart search across all entities with ranking
   */
  async smartSearch(query: string, options: {
    includeInbox?: boolean;
    maxResults?: number;
    sortBy?: 'relevance' | 'modified' | 'created';
  } = {}): Promise<{
    results: Array<{
      type: 'note' | 'idea' | 'concept';
      item: Note | Idea | Concept;
      relevanceScore: number;
    }>;
    totalFound: number;
  }> {
    const searchResults = await this.searchAll(query);
    const results: Array<{
      type: 'note' | 'idea' | 'concept';
      item: Note | Idea | Concept;
      relevanceScore: number;
    }> = [];

    // Simple relevance scoring
    const calculateRelevance = (content: string, title?: string): number => {
      const queryLower = query.toLowerCase();
      let score = 0;
      
      if (title?.toLowerCase().includes(queryLower)) score += 10;
      score += (content.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
      
      return score;
    };

    // Add notes
    for (const note of searchResults.notes) {
      results.push({
        type: 'note',
        item: note,
        relevanceScore: calculateRelevance(note.content, note.metadata.title)
      });
    }

    // Add ideas (if including inbox)
    if (options.includeInbox) {
      for (const idea of searchResults.ideas) {
        results.push({
          type: 'idea',
          item: idea,
          relevanceScore: calculateRelevance(idea.content)
        });
      }
    }

    // Add concepts
    for (const concept of searchResults.concepts) {
      results.push({
        type: 'concept',
        item: concept,
        relevanceScore: calculateRelevance(concept.content, concept.name)
      });
    }

    // Sort by relevance or date
    if (options.sortBy === 'relevance' || !options.sortBy) {
      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    } else {
      results.sort((a, b) => {
        const aDate = options.sortBy === 'modified' 
          ? new Date(a.item.metadata.modified || 0) 
          : new Date(a.item.metadata.created || 0);
        const bDate = options.sortBy === 'modified'
          ? new Date(b.item.metadata.modified || 0)
          : new Date(b.item.metadata.created || 0);
        return bDate.getTime() - aDate.getTime();
      });
    }

    const maxResults = options.maxResults || 20;
    return {
      results: results.slice(0, maxResults),
      totalFound: results.length
    };
  }
}

// Export singleton instance
export const dataHandler = new UniversalDataHandler();
export default dataHandler;