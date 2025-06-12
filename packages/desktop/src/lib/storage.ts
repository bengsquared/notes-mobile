import { promises as fs } from 'fs';
import path from 'path';
import type { Note, Concept, ConceptMetadata, MediaFile, ParsedContent, NoteMetadata } from '../../../shared/src/types';
import { FileParser } from './file-parser';
import { extractTitleFromContent } from '../../utils/title-utils';

// ============================================================================
// SIMPLIFIED TYPES
// ============================================================================

// Ideas are inbox items (unprocessed thoughts)
export interface Idea {
  id: string;
  filename: string;
  content: string;
  metadata: NoteMetadata;
  created: string;
  modified: string;
  location: 'inbox';
}

// Validation types
export interface ValidationIssue {
  type: 'orphaned-backlink' | 'missing-backlink' | 'broken-link' | 'invalid-concept' | 'orphaned-media';
  severity: 'error' | 'warning';
  source: string;
  target?: string;
  description: string;
}

export interface ValidationReport {
  hasIssues: boolean;
  issues: ValidationIssue[];
  stats: {
    notesChecked: number;
    conceptsChecked: number;
    relationsChecked: number;
    mediaChecked: number;
  };
}

// ============================================================================
// SIMPLE VALIDATION - Replace complex validation with basic checks
// ============================================================================

function validateNote(filename: string, content: string): void {
  if (!filename || !content) {
    throw new Error('Filename and content are required');
  }
  
  if (!/^[a-zA-Z0-9_\-\s.]+\.(txt|md)$/.test(filename) || filename.length > 255) {
    throw new Error('Invalid filename format');
  }
}

function validateConceptName(name: string): void {
  if (!name || !/^[a-zA-Z0-9\-_]+$/.test(name) || name.length > 50) {
    throw new Error('Invalid concept name format');
  }
}



// ============================================================================
// SIMPLE FILE LOCKING
// ============================================================================

class SimpleLock {
  private locks = new Map<string, Promise<void>>();

  async withLock<T>(filePath: string, operation: () => Promise<T>): Promise<T> {
    const existingLock = this.locks.get(filePath);
    if (existingLock) await existingLock;

    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    
    this.locks.set(filePath, lockPromise);

    try {
      return await operation();
    } finally {
      this.locks.delete(filePath);
      resolveLock!();
    }
  }
}

// ============================================================================
// RELATION MANAGER - Handles all relationship operations
// ============================================================================

export class RelationManager {
  constructor(private storage: NotesStorage) {}


  // Note-to-Concept relations (bidirectional)
  async addNoteConcept(noteFilename: string, conceptName: string): Promise<void> {
    // Ensure concept exists
    await this.storage.ensureConceptExists(conceptName);
        
    try {
      // Update concept's linkedNotes
      const concept = await this.storage.getConcept(conceptName);
      const linkedNotes = new Set(concept.metadata.linkedNotes || []);
      linkedNotes.add(noteFilename);
      
      await this.storage.updateConceptMetadata(conceptName, {
        ...concept.metadata,
        linkedNotes: Array.from(linkedNotes)
      });

      // Update note's concepts array
      const note = await this.storage.loadNote(noteFilename);
      const concepts = new Set(note.metadata.concepts || []);
      concepts.add(conceptName);
      
      await this.storage.updateNoteMetadata(noteFilename, {
        ...note.metadata,
        concepts: Array.from(concepts)
      });
    } catch (error) {
      throw new Error(`Failed to add note-concept relation: ${error}`);
    }
  }

  async removeNoteConcept(noteFilename: string, conceptName: string): Promise<void> {
    try {
      // Update concept's linkedNotes
      const concept = await this.storage.getConcept(conceptName);
      const linkedNotes = (concept.metadata.linkedNotes || []).filter(n => n !== noteFilename);
      
      await this.storage.updateConceptMetadata(conceptName, {
        ...concept.metadata,
        linkedNotes
      });

      // Update note's concepts array
      try {
        const note = await this.storage.loadNote(noteFilename);
        const concepts = (note.metadata.concepts || []).filter(c => c !== conceptName);
        
        await this.storage.updateNoteMetadata(noteFilename, {
          ...note.metadata,
          concepts
        });
      } catch (noteError) {
        // If note update fails, try to rollback concept update
        // Failed to update note, attempting rollback
        try {
          await this.storage.updateConceptMetadata(conceptName, concept.metadata);
        } catch (rollbackError) {
          // Rollback failed
        }
        throw noteError;
      }
    } catch {
      // Concept doesn't exist, nothing to remove
    }
  }

  // Update all concept relations for a note
  async updateNoteConcepts(noteFilename: string, oldConcepts: string[], newConcepts: string[]): Promise<void> {
    const oldSet = new Set(oldConcepts);
    const newSet = new Set(newConcepts);
    
    // Remove relations for concepts no longer associated
    for (const concept of oldSet) {
      if (!newSet.has(concept)) {
        await this.removeNoteConcept(noteFilename, concept);
      }
    }
    
    // Add relations for new concepts
    for (const concept of newSet) {
      if (!oldSet.has(concept)) {
        await this.addNoteConcept(noteFilename, concept);
      }
    }
  }

  // Note-to-Note relations (bidirectional)
  async addNoteLink(fromNote: string, toNote: string): Promise<void> {
    try {
      // Update 'from' note's links
      const from = await this.storage.loadNote(fromNote);
      const fromLinks = new Set(from.metadata.links || []);
      fromLinks.add(toNote);
      
      await this.storage.updateNoteMetadata(fromNote, {
        ...from.metadata,
        links: Array.from(fromLinks)
      });

      // Update 'to' note's backlinks
      const to = await this.storage.loadNote(toNote);
      const toBacklinks = new Set(to.metadata.backlinks || []);
      toBacklinks.add(fromNote);
      
      await this.storage.updateNoteMetadata(toNote, {
        ...to.metadata,
        backlinks: Array.from(toBacklinks)
      });
    } catch (error) {
      throw new Error(`Failed to add note link: ${error}`);
    }
  }

  async removeNoteLink(fromNote: string, toNote: string): Promise<void> {
    try {
      // Update 'from' note's links
      const from = await this.storage.loadNote(fromNote);
      const fromLinks = (from.metadata.links || []).filter(l => l !== toNote);
      
      await this.storage.updateNoteMetadata(fromNote, {
        ...from.metadata,
        links: fromLinks
      });

      // Update 'to' note's backlinks
      try {
        const to = await this.storage.loadNote(toNote);
        const toBacklinks = (to.metadata.backlinks || []).filter(b => b !== fromNote);
        
        await this.storage.updateNoteMetadata(toNote, {
          ...to.metadata,
          backlinks: toBacklinks
        });
      } catch {
        // Target note doesn't exist, skip updating it
      }
    } catch {
      // Source note doesn't exist, nothing to remove
    }
  }

  async updateNoteLinks(noteFilename: string, oldLinks: string[], newLinks: string[]): Promise<void> {
    const oldSet = new Set(oldLinks);
    const newSet = new Set(newLinks);
    
    // Remove links no longer present
    for (const link of oldSet) {
      if (!newSet.has(link)) {
        await this.removeNoteLink(noteFilename, link);
      }
    }
    
    // Add new links
    for (const link of newSet) {
      if (!oldSet.has(link)) {
        await this.addNoteLink(noteFilename, link);
      }
    }
  }

  // Concept-to-Concept relations (bidirectional)
  async addConceptRelation(fromConcept: string, toConcept: string): Promise<void> {
    // Ensure both concepts exist
    await this.storage.ensureConceptExists(fromConcept);
    await this.storage.ensureConceptExists(toConcept);
    
    try {
      // Update 'from' concept's relatedConcepts
      const from = await this.storage.getConcept(fromConcept);
      const fromRelated = new Set(from.metadata.relatedConcepts || []);
      fromRelated.add(toConcept);
      
      await this.storage.updateConceptMetadata(fromConcept, {
        ...from.metadata,
        relatedConcepts: Array.from(fromRelated)
      });

      // Update 'to' concept's relatedConcepts (bidirectional)
      const to = await this.storage.getConcept(toConcept);
      const toRelated = new Set(to.metadata.relatedConcepts || []);
      toRelated.add(fromConcept);
      
      await this.storage.updateConceptMetadata(toConcept, {
        ...to.metadata,
        relatedConcepts: Array.from(toRelated)
      });
    } catch (error) {
      throw new Error(`Failed to add concept relation: ${error}`);
    }
  }

  async removeConceptRelation(fromConcept: string, toConcept: string): Promise<void> {
    try {
      // Update 'from' concept's relatedConcepts
      const from = await this.storage.getConcept(fromConcept);
      const fromRelated = (from.metadata.relatedConcepts || []).filter(c => c !== toConcept);
      
      await this.storage.updateConceptMetadata(fromConcept, {
        ...from.metadata,
        relatedConcepts: fromRelated
      });

      // Update 'to' concept's relatedConcepts
      try {
        const to = await this.storage.getConcept(toConcept);
        const toRelated = (to.metadata.relatedConcepts || []).filter(c => c !== fromConcept);
        
        await this.storage.updateConceptMetadata(toConcept, {
          ...to.metadata,
          relatedConcepts: toRelated
        });
      } catch {
        // Target concept doesn't exist, skip updating it
      }
    } catch {
      // Source concept doesn't exist, nothing to remove
    }
  }

  async updateConceptRelations(conceptName: string, oldRelated: string[], newRelated: string[]): Promise<void> {
    const oldSet = new Set(oldRelated);
    const newSet = new Set(newRelated);
    
    // Remove relations no longer present
    for (const related of oldSet) {
      if (!newSet.has(related)) {
        await this.removeConceptRelation(conceptName, related);
      }
    }
    
    // Add new relations
    for (const related of newSet) {
      if (!oldSet.has(related)) {
        await this.addConceptRelation(conceptName, related);
      }
    }
  }

  // Validate all relations
  async validateRelations(): Promise<ValidationReport> {
    const issues: ValidationIssue[] = [];
    let notesChecked = 0;
    let conceptsChecked = 0;
    let relationsChecked = 0;
    let mediaChecked = 0;

    // Check all concepts
    const concepts = await this.storage.listConcepts();
    for (const concept of concepts) {
      conceptsChecked++;
      
      // Check each linked note exists
      for (const noteFilename of (concept.metadata.linkedNotes || [])) {
        relationsChecked++;
        const exists = await this.storage.noteExists(noteFilename);
        if (!exists) {
          issues.push({
            type: 'orphaned-backlink',
            severity: 'error',
            source: concept.name,
            target: noteFilename,
            description: `Concept "${concept.name}" links to non-existent note "${noteFilename}"`
          });
        }
      }
      
      // Check concept-to-concept relations are bidirectional
      for (const relatedConcept of (concept.metadata.relatedConcepts || [])) {
        relationsChecked++;
        try {
          const related = await this.storage.getConcept(relatedConcept);
          if (!(related.metadata.relatedConcepts || []).includes(concept.name)) {
            issues.push({
              type: 'missing-backlink',
              severity: 'error',
              source: concept.name,
              target: relatedConcept,
              description: `Concept "${concept.name}" relates to "${relatedConcept}" but relation is not bidirectional`
            });
          }
        } catch {
          issues.push({
            type: 'invalid-concept',
            severity: 'error',
            source: concept.name,
            target: relatedConcept,
            description: `Concept "${concept.name}" relates to non-existent concept "${relatedConcept}"`
          });
        }
      }
    }

    // Check all notes
    const notes = await this.storage.listNotes('all');
    for (const note of notes) {
      notesChecked++;
      
      // Check each concept reference has a backlink
      for (const conceptName of (note.metadata.concepts || [])) {
        relationsChecked++;
        try {
          const concept = await this.storage.getConcept(conceptName);
          if (!(concept.metadata.linkedNotes || []).includes(note.filename)) {
            issues.push({
              type: 'missing-backlink',
              severity: 'error',
              source: note.filename,
              target: conceptName,
              description: `Note "${note.filename}" references concept "${conceptName}" but concept doesn't have backlink`
            });
          }
        } catch {
          issues.push({
            type: 'invalid-concept',
            severity: 'error',
            source: note.filename,
            target: conceptName,
            description: `Note "${note.filename}" references non-existent concept "${conceptName}"`
          });
        }
      }
      
      // Check note links exist and have backlinks
      for (const linkedNote of (note.metadata.links || [])) {
        relationsChecked++;
        const exists = await this.storage.noteExists(linkedNote);
        if (!exists) {
          issues.push({
            type: 'broken-link',
            severity: 'warning',
            source: note.filename,
            target: linkedNote,
            description: `Note "${note.filename}" links to non-existent note "${linkedNote}"`
          });
        } else {
          // Check if linked note has backlink
          try {
            const linked = await this.storage.loadNote(linkedNote);
            if (!(linked.metadata.backlinks || []).includes(note.filename)) {
              issues.push({
                type: 'missing-backlink',
                severity: 'error',
                source: note.filename,
                target: linkedNote,
                description: `Note "${note.filename}" links to "${linkedNote}" but linked note doesn't have backlink`
              });
            }
          } catch {
            // Error loading linked note
          }
        }
      }
      
      // Check backlinks point to valid notes that actually link here
      for (const backlink of (note.metadata.backlinks || [])) {
        relationsChecked++;
        const exists = await this.storage.noteExists(backlink);
        if (!exists) {
          issues.push({
            type: 'orphaned-backlink',
            severity: 'error',
            source: note.filename,
            target: backlink,
            description: `Note "${note.filename}" has backlink from non-existent note "${backlink}"`
          });
        } else {
          // Check if backlinking note actually links here
          try {
            const backlinking = await this.storage.loadNote(backlink);
            if (!(backlinking.metadata.links || []).includes(note.filename)) {
              issues.push({
                type: 'orphaned-backlink',
                severity: 'error',
                source: note.filename,
                target: backlink,
                description: `Note "${note.filename}" has backlink from "${backlink}" but that note doesn't link here`
              });
            }
          } catch {
            // Error loading backlinking note
          }
        }
      }
    }

    // Check for orphaned media files
    const allMedia = await this.storage.listAllMedia();
    for (const media of allMedia) {
      mediaChecked++;
      const noteBase = this.storage.extractNoteBaseFromMedia(media.filename);
      if (noteBase) {
        const noteExists = await this.storage.noteExists(`${noteBase}.txt`);
        if (!noteExists) {
          issues.push({
            type: 'orphaned-media',
            severity: 'warning',
            source: media.filename,
            description: `Media file "${media.filename}" has no parent note`
          });
        }
      }
    }

    return {
      hasIssues: issues.length > 0,
      issues,
      stats: {
        notesChecked,
        conceptsChecked,
        relationsChecked,
        mediaChecked
      }
    };
  }

  // Repair relations based on validation
  async repairRelations(): Promise<{ fixed: number; issues: string[] }> {
    const validation = await this.validateRelations();
    let fixed = 0;
    const issues: string[] = [];

    for (const issue of validation.issues) {
      try {
        switch (issue.type) {
          case 'orphaned-backlink':
            // Determine the type of orphaned backlink and fix appropriately
            if (issue.description.includes('Concept') && issue.description.includes('links to non-existent note')) {
              // Remove orphaned note from concept's linkedNotes
              await this.removeNoteConcept(issue.target!, issue.source);
              issues.push(`Removed orphaned note reference from concept: ${issue.source} -> ${issue.target}`);
            } else if (issue.description.includes('has backlink from')) {
              // Remove orphaned backlink from note
              const note = await this.storage.loadNote(issue.source);
              const backlinks = (note.metadata.backlinks || []).filter(b => b !== issue.target);
              await this.storage.updateNoteMetadata(issue.source, {
                ...note.metadata,
                backlinks
              });
              issues.push(`Removed orphaned backlink from note: ${issue.source} <- ${issue.target}`);
            }
            fixed++;
            break;
            
          case 'missing-backlink':
            // Determine the type of missing backlink and fix appropriately
            if (issue.description.includes('references concept')) {
              // Add missing backlink to concept
              await this.addNoteConcept(issue.source, issue.target!);
              issues.push(`Added missing backlink to concept: ${issue.target} <- ${issue.source}`);
            } else if (issue.description.includes('links to') && issue.description.includes('but linked note')) {
              // Add missing backlink to linked note
              await this.addNoteLink(issue.source, issue.target!);
              issues.push(`Added missing backlink to note: ${issue.target} <- ${issue.source}`);
            } else if (issue.description.includes('relates to') && issue.description.includes('not bidirectional')) {
              // Add missing concept relation
              await this.addConceptRelation(issue.source, issue.target!);
              issues.push(`Added missing concept relation: ${issue.target} <-> ${issue.source}`);
            }
            fixed++;
            break;
            
          case 'orphaned-media':
            // For now, just report - don't auto-delete media
            issues.push(`Found orphaned media: ${issue.source} (not auto-deleted)`);
            break;
        }
      } catch (error) {
        issues.push(`Failed to fix ${issue.type}: ${error}`);
      }
    }

    return { fixed, issues };
  }

  // Conflict resolution methods
  async resolveFilenameConflict(basename: string, extension: string = '.txt'): Promise<string> {
    let counter = 1;
    let filename = `${basename}${extension}`;
    
    while (await this.storage.fileExists(filename)) {
      counter++;
      filename = `${basename}-${counter}${extension}`;
    }
    
    return filename;
  }

  resolveMediaFilename(noteBase: string, mediaType: string, originalExt: string, index: number = 1): string {
    return `${noteBase}-${mediaType}-${index}${originalExt}`;
  }
}


// ============================================================================
// MAIN STORAGE CLASS
// ============================================================================

export class NotesStorage {
  public notesDirectory: string;
  private relationManager: RelationManager;
  private lockManager: SimpleLock;

  constructor(notesDirectory: string) {
    this.notesDirectory = notesDirectory;
    this.relationManager = new RelationManager(this);
    this.lockManager = new SimpleLock();
  }

  // Public getter for relations
  get relations(): RelationManager {
    return this.relationManager;
  }

  // Directory paths
  private get inboxPath() {
    return path.join(this.notesDirectory, 'inbox');
  }

  private get conceptsPath() {
    return path.join(this.notesDirectory, 'concepts');
  }

  private get metadataPath() {
    return path.join(this.notesDirectory, '.notes-metadata');
  }

  async initialize() {
    await fs.mkdir(this.inboxPath, { recursive: true });
    await fs.mkdir(this.conceptsPath, { recursive: true });
    await fs.mkdir(this.metadataPath, { recursive: true });
  }

  // ============================================================================
  // NOTE OPERATIONS
  // ============================================================================

  async saveNote(filename: string, content: string, metadata?: NoteMetadata, location?: 'inbox' | 'notes'): Promise<boolean> {
    // Simple validation
    validateNote(filename, content);
    
    const noteLocation = location || ((filename.includes('/inbox/') || filename.includes('inbox/')) ? 'inbox' : 'notes');
    const fullPath = noteLocation === 'inbox' 
      ? path.join(this.inboxPath, path.basename(filename))
      : path.join(this.notesDirectory, filename);

    // Load existing note to check for concept changes (only for regular notes)
    let oldConcepts: string[] = [];
    if (noteLocation === 'notes') {
      try {
        const existing = await this.loadNote(filename);
        oldConcepts = existing.metadata.concepts || [];
      } catch {
        // New note, no existing concepts
      }
    }

    // Prepare note content using FileParser
    const noteContent = FileParser.formatNoteContent(content, metadata);

    // Write file with lock
    await this.lockManager.withLock(fullPath, async () => {
      await fs.writeFile(fullPath, noteContent, 'utf8');
    });
    
    // Update bidirectional concept relations ONLY for regular notes
    if (noteLocation === 'notes' && metadata?.concepts) {
      await this.relations.updateNoteConcepts(filename, oldConcepts, metadata.concepts);
    }

    return true;
  }

  async loadNote(filename: string): Promise<Note> {
    const inInbox = await this.fileExists(path.join(this.inboxPath, filename));
    const fullPath = inInbox
      ? path.join(this.inboxPath, filename)
      : path.join(this.notesDirectory, filename);

    const rawContent = await fs.readFile(fullPath, 'utf8');
    const parsed = FileParser.parseFileContent(rawContent);
    const stats = await fs.stat(fullPath);

    return {
      filename,
      content: parsed.content,
      metadata: {
        ...parsed.metadata,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString()
      },
      location: inInbox ? 'inbox' : 'notes'
    };
  }

  async listNotes(location: 'inbox' | 'notes' | 'all' = 'all'): Promise<Note[]> {
    const notes: Note[] = [];

    if (location === 'inbox' || location === 'all') {
      const inboxFiles = await this.listTextFiles(this.inboxPath);
      for (const file of inboxFiles) {
        try {
          const note = await this.loadNote(file);
          notes.push(note);
        } catch (err) {
          // Warning: Could not load note
        }
      }
    }

    if (location === 'notes' || location === 'all') {
      const mainFiles = await this.listTextFiles(this.notesDirectory);
      for (const file of mainFiles) {
        try {
          const note = await this.loadNote(file);
          notes.push(note);
        } catch (err) {
          // Warning: Could not load note
        }
      }
    }

    return notes;
  }

  async deleteNote(filename: string): Promise<boolean> {
    const inInbox = await this.fileExists(path.join(this.inboxPath, filename));
    const fullPath = inInbox
      ? path.join(this.inboxPath, filename)
      : path.join(this.notesDirectory, filename);

    // Load note to get concepts for cleanup
    const note = await this.loadNote(filename);
    
    // Remove from concept links (only for regular notes)
    if (note.location === 'notes' && note.metadata.concepts) {
      for (const concept of note.metadata.concepts) {
        await this.relations.removeNoteConcept(filename, concept);
      }
    }

    // Delete file with lock
    await this.lockManager.withLock(fullPath, async () => {
      await fs.unlink(fullPath);
    });

    return true;
  }

  async renameNote(oldFilename: string, newFilename: string): Promise<boolean> {
    // Validate new filename is unique
    const isUnique = await this.checkFilenameUnique(newFilename, oldFilename);
    if (!isUnique) {
      throw new Error(`A note with the filename "${newFilename}" already exists`);
    }

    // Determine current location
    const inInbox = await this.fileExists(path.join(this.inboxPath, oldFilename));
    const baseDir = inInbox ? this.inboxPath : this.notesDirectory;
    
    const oldPath = path.join(baseDir, oldFilename);
    const newPath = path.join(baseDir, newFilename);

    // Load note to update concept links
    const note = await this.loadNote(oldFilename);
    
    // Rename the note file
    await fs.rename(oldPath, newPath);

    // Update concept links - different handling for notes vs ideas
    if (note.metadata.concepts && note.metadata.concepts.length > 0) {
      if (inInbox) {
        // For ideas: concepts are just metadata, no bidirectional relations needed
        // The file has already been renamed, so the metadata is preserved
        // Idea renamed, concept metadata preserved in file
      } else {
        // For notes: update bidirectional concept relations
        for (const concept of note.metadata.concepts) {
          await this.relations.removeNoteConcept(oldFilename, concept);
          await this.relations.addNoteConcept(newFilename, concept);
        }
      }
    }

    // Rename associated media files
    await this.renameAssociatedMediaFiles(oldFilename, newFilename, baseDir);

    return true;
  }

  async checkFilenameUnique(filename: string, excludeFilename?: string): Promise<boolean> {
    const inboxPath = path.join(this.inboxPath, filename);
    const mainPath = path.join(this.notesDirectory, filename);
    
    if (excludeFilename) {
      const excludeInboxPath = path.join(this.inboxPath, excludeFilename);
      const excludeMainPath = path.join(this.notesDirectory, excludeFilename);
      
      const inboxExists = await this.fileExists(inboxPath);
      const mainExists = await this.fileExists(mainPath);
      
      return !((inboxExists && inboxPath !== excludeInboxPath) || 
               (mainExists && mainPath !== excludeMainPath));
    }
    
    const inboxExists = await this.fileExists(inboxPath);
    const mainExists = await this.fileExists(mainPath);
    
    return !inboxExists && !mainExists;
  }

  async noteExists(filename: string): Promise<boolean> {
    const inboxPath = path.join(this.inboxPath, filename);
    const mainPath = path.join(this.notesDirectory, filename);
    
    return (await this.fileExists(inboxPath)) || (await this.fileExists(mainPath));
  }

  // ============================================================================
  // CONCEPT OPERATIONS
  // ============================================================================

  async createConcept(conceptName: string): Promise<boolean> {
    validateConceptName(conceptName);

    const conceptPath = path.join(this.conceptsPath, `${conceptName}.txt`);
    const exists = await this.fileExists(conceptPath);
    
    if (exists) {
      throw new Error(`Concept "${conceptName}" already exists`);
    }

    const metadata: ConceptMetadata = {
      linkedNotes: [],
      relatedConcepts: []
    };

    return this.saveConcept(conceptName, '', metadata);
  }

  async listConcepts(): Promise<Concept[]> {
    const files = await fs.readdir(this.conceptsPath);
    const concepts: Concept[] = [];

    for (const file of files) {
      if (file.endsWith('.txt')) {
        const name = path.basename(file, '.txt');
        try {
          const concept = await this.getConcept(name);
          concepts.push(concept);
        } catch (err) {
          // Warning: Could not load concept
        }
      }
    }

    return concepts;
  }

  async getConcept(conceptName: string): Promise<Concept> {
    const filePath = path.join(this.conceptsPath, `${conceptName}.txt`);
    
    const rawContent = await fs.readFile(filePath, 'utf8');
    
    const parsed = FileParser.parseFileContent(rawContent);
    
    const stats = await fs.stat(filePath);

    const finalConcept = {
      name: conceptName,
      content: parsed.content,
      metadata: {
        ...parsed.metadata,
        linkedNotes: parsed.metadata.links || [],
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString()
      }
    };
    
    return finalConcept;
  }

  async saveConcept(conceptName: string, content: string, metadata?: ConceptMetadata): Promise<boolean> {
    const filePath = path.join(this.conceptsPath, `${conceptName}.txt`);
    
    // Convert concept metadata to note format
    const noteMetadata: NoteMetadata = {
      links: metadata?.linkedNotes,
      // Don't put relatedConcepts in concepts field - keep them separate
      ...(metadata?.relatedConcepts && { relatedConcepts: metadata.relatedConcepts } as any)
    };
    
    const conceptContent = FileParser.formatNoteContent(content, noteMetadata);
    await fs.writeFile(filePath, conceptContent, 'utf8');
    return true;
  }

  async deleteConcept(conceptName: string): Promise<boolean> {
    // Check if any notes reference this concept
    const notes = await this.listNotes('all');
    const referencingNotes = notes.filter((note: Note) => 
      (note.metadata.concepts || []).includes(conceptName)
    );

    if (referencingNotes.length > 0) {
      const noteList = referencingNotes.map((n: Note) => n.filename).join(', ');
      throw new Error(
        `Cannot delete concept "${conceptName}" because it is referenced by notes: ${noteList}`
      );
    }

    const filePath = path.join(this.conceptsPath, `${conceptName}.txt`);
    await fs.unlink(filePath);
    return true;
  }

  async updateConceptMetadata(conceptName: string, metadata: ConceptMetadata): Promise<void> {
    const concept = await this.getConcept(conceptName);
    // Use direct save - saveConcept doesn't have relation update logic, so it's safe
    await this.saveConcept(conceptName, concept.content, metadata);
  }

  async updateNoteMetadata(filename: string, metadata: NoteMetadata): Promise<void> {
    const note = await this.loadNote(filename);
    // Use a direct save without triggering relation updates to avoid circular dependencies
    await this.saveNoteWithoutRelationUpdates(filename, note.content, metadata);
  }

  private async saveNoteWithoutRelationUpdates(filename: string, content: string, metadata?: NoteMetadata): Promise<boolean> {
    // Simple validation
    validateNote(filename, content);
    
    const noteLocation = filename.includes('/inbox/') || filename.includes('inbox/') ? 'inbox' : 'notes';
    const fullPath = noteLocation === 'inbox' 
      ? path.join(this.inboxPath, path.basename(filename))
      : path.join(this.notesDirectory, filename);

    // Prepare note content using FileParser
    const noteContent = FileParser.formatNoteContent(content, metadata);

    // Write file with lock (but skip relation updates)
    await this.lockManager.withLock(fullPath, async () => {
      await fs.writeFile(fullPath, noteContent, 'utf8');
    });

    return true;
  }

  async ensureConceptExists(conceptName: string): Promise<void> {
    try {
      await this.getConcept(conceptName);
    } catch {
      // Create concept if it doesn't exist
      await this.createConcept(conceptName);
    }
  }

  // ============================================================================
  // FILENAME UTILITIES
  // ============================================================================

  /**
   * Generate a unique filename by appending numbers if needed
   * e.g., "new-idea" -> "new-idea", "new-idea-1", "new-idea-2", etc.
   */
  private async generateUniqueFilename(baseName: string, extension: string, directory: string): Promise<string> {
    let counter = 0;
    let filename = `${baseName}${extension}`;
    
    while (await this.fileExists(path.join(directory, filename))) {
      counter++;
      filename = `${baseName}-${counter}${extension}`;
    }
    
    return filename;
  }


  // ============================================================================
  // IDEA/INBOX OPERATIONS
  // ============================================================================

  async createIdea(content: string, metadata: Partial<NoteMetadata> = {}): Promise<Idea> {
    // Generate a unique filename starting with "new-idea"
    const filename = await this.generateUniqueFilename('new-idea', '.txt', this.inboxPath);
    const id = filename.replace('.txt', '');
    
    // Auto-extract title from content if not provided
    const enhancedMetadata: Partial<NoteMetadata> = {
      ...metadata
    };
    
    if (!enhancedMetadata.title) {
      if (content?.trim()) {
        enhancedMetadata.title = extractTitleFromContent(content);
      } else {
        // Default title for empty ideas
        enhancedMetadata.title = 'New idea';
      }
    }
    
    const noteContent = FileParser.formatNoteContent(content, enhancedMetadata);
    const fullPath = path.join(this.inboxPath, filename);
    await fs.writeFile(fullPath, noteContent, 'utf8');
    
    const stats = await fs.stat(fullPath);
    
    return {
      id,
      filename,
      content,
      metadata: enhancedMetadata as NoteMetadata,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      location: 'inbox'
    };
  }

  async listIdeas(): Promise<Idea[]> {
    const ideas: Idea[] = [];
    const inboxFiles = await this.listTextFiles(this.inboxPath);
    
    for (const file of inboxFiles) {
      try {
        const fullPath = path.join(this.inboxPath, file);
        const rawContent = await fs.readFile(fullPath, 'utf8');
        const parsed = FileParser.parseFileContent(rawContent);
        const stats = await fs.stat(fullPath);
        
        ideas.push({
          id: file.replace('.txt', ''),
          filename: file,
          content: parsed.content,
          metadata: parsed.metadata,
          created: stats.birthtime.toISOString(),
          modified: stats.mtime.toISOString(),
          location: 'inbox'
        });
      } catch (err) {
        // Warning: Could not load idea
      }
    }
    
    return ideas.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  }

  async updateIdea(filename: string, content: string, metadata: Partial<NoteMetadata> = {}): Promise<Idea> {
    const existing = await this.loadIdea(filename);
    
    const updatedMetadata: NoteMetadata = {
      ...existing.metadata,
      ...metadata
    };
    
    const noteContent = FileParser.formatNoteContent(content, updatedMetadata);
    const fullPath = path.join(this.inboxPath, filename);
    await fs.writeFile(fullPath, noteContent, 'utf8');
    
    const stats = await fs.stat(fullPath);
    
    return {
      id: filename.replace('.txt', ''),
      filename,
      content,
      metadata: updatedMetadata,
      created: existing.created,
      modified: stats.mtime.toISOString(),
      location: 'inbox'
    };
  }

  async loadIdea(filename: string): Promise<Idea> {
    const fullPath = path.join(this.inboxPath, filename);
    const rawContent = await fs.readFile(fullPath, 'utf8');
    const parsed = FileParser.parseFileContent(rawContent);
    const stats = await fs.stat(fullPath);
    
    return {
      id: filename.replace('.txt', ''),
      filename,
      content: parsed.content,
      metadata: parsed.metadata,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString(),
      location: 'inbox'
    };
  }

  async deleteIdea(filename: string): Promise<void> {
    const fullPath = path.join(this.inboxPath, filename);
    await fs.unlink(fullPath);
    
    // Also delete any associated media
    const mediaFiles = await this.listMediaForNote(filename);
    for (const media of mediaFiles) {
      await this.deleteMedia(media.filename);
    }
  }

  // Idea metadata operations for context sidebar
  async attachConceptToIdea(filename: string, conceptName: string): Promise<void> {
    const idea = await this.loadIdea(filename);
    const concepts = new Set(idea.metadata.concepts || []);
    concepts.add(conceptName);
    
    await this.updateIdea(filename, idea.content, {
      ...idea.metadata,
      concepts: Array.from(concepts)
    });
  }

  async removeConceptFromIdea(filename: string, conceptName: string): Promise<void> {
    const idea = await this.loadIdea(filename);
    const concepts = (idea.metadata.concepts || []).filter(c => c !== conceptName);
    
    await this.updateIdea(filename, idea.content, {
      ...idea.metadata,
      concepts
    });
  }

  async linkNoteToIdea(ideaFilename: string, noteFilename: string): Promise<void> {
    const idea = await this.loadIdea(ideaFilename);
    const links = new Set(idea.metadata.links || []);
    links.add(noteFilename);
    
    await this.updateIdea(ideaFilename, idea.content, {
      ...idea.metadata,
      links: Array.from(links)
    });
  }

  async removeNoteLinkFromIdea(ideaFilename: string, noteFilename: string): Promise<void> {
    const idea = await this.loadIdea(ideaFilename);
    const links = (idea.metadata.links || []).filter(l => l !== noteFilename);
    
    await this.updateIdea(ideaFilename, idea.content, {
      ...idea.metadata,
      links
    });
  }

  async updateIdeaMetadata(filename: string, metadata: Partial<NoteMetadata>): Promise<void> {
    const idea = await this.loadIdea(filename);
    await this.updateIdea(filename, idea.content, {
      ...idea.metadata,
      ...metadata
    });
  }

  async promoteIdeaToNote(ideaFilename: string, title: string, concepts: string[] = []): Promise<Note> {
    const idea = await this.loadIdea(ideaFilename);
    
    // Create note filename from title
    const noteId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let noteFilename = `${noteId}.txt`;
    
    // Resolve conflicts
    noteFilename = await this.relations.resolveFilenameConflict(noteId, '.txt');
    
    // Parse content for auto-detection
    const parsedContent = FileParser.parseContent(idea.content);
    
    // Merge concepts
    const ideaConcepts = idea.metadata.concepts || [];
    const allConcepts = [...new Set([...concepts, ...parsedContent.concepts, ...ideaConcepts])];
    
    // Ensure all concepts exist
    for (const conceptName of allConcepts) {
      await this.ensureConceptExists(conceptName);
    }
    
    // Create note metadata
    const noteMetadata: NoteMetadata = {
      title,
      concepts: allConcepts,
      links: [...new Set([...parsedContent.noteLinks, ...(idea.metadata.links || [])])]
    };
    
    // Save as note - this will create bidirectional concept links
    await this.saveNote(noteFilename, idea.content, noteMetadata);
    
    // Delete original idea
    await this.deleteIdea(ideaFilename);
    
    return await this.loadNote(noteFilename);
  }

  // ============================================================================
  // MEDIA OPERATIONS
  // ============================================================================

  async saveMedia(filename: string, data: string | Buffer, mimeType?: string, noteFilename?: string): Promise<string> {
    let finalFilename = filename;
    
    // If we have a note filename, use proper media naming convention
    if (noteFilename) {
      const noteBase = path.basename(noteFilename, '.txt');
      const ext = path.extname(filename);
      const mediaType = this.getMediaTypeFromMime(mimeType || this.getMimeType(ext));
      let counter = 1;
      while (await this.fileExists(path.join(this.notesDirectory, `${noteBase}-${mediaType}-${counter}${ext}`))) {
        counter++;
      }
      finalFilename = `${noteBase}-${mediaType}-${counter}${ext}`;
    } else {
      // Use conflict resolver for general filename conflicts
      const basename = path.basename(filename, path.extname(filename));
      const ext = path.extname(filename);
      finalFilename = await this.relations.resolveFilenameConflict(basename, ext);
    }
    
    const fullPath = path.join(this.notesDirectory, finalFilename);
    
    if (typeof data === 'string') {
      // Assume base64 encoded
      const buffer = Buffer.from(data, 'base64');
      await fs.writeFile(fullPath, buffer);
    } else {
      await fs.writeFile(fullPath, data);
    }

    return finalFilename;
  }

  async loadMedia(filename: string): Promise<{ data: string; mimeType: string }> {
    const fullPath = path.join(this.notesDirectory, filename);
    const buffer = await fs.readFile(fullPath);
    const base64 = buffer.toString('base64');
    const ext = path.extname(filename).toLowerCase();
    
    return {
      data: base64,
      mimeType: this.getMimeType(ext)
    };
  }

  async listMediaForNote(noteFilename: string): Promise<MediaFile[]> {
    const baseName = path.basename(noteFilename, '.txt');
    const location = noteFilename.includes('/inbox/') ? this.inboxPath : this.notesDirectory;
    
    const files = await fs.readdir(location);
    const mediaFiles: MediaFile[] = [];

    for (const file of files) {
      if (file.startsWith(baseName) && !file.endsWith('.txt')) {
        const fullPath = path.join(location, file);
        const stats = await fs.stat(fullPath);
        const ext = path.extname(file).toLowerCase();

        mediaFiles.push({
          filename: file,
          mimeType: this.getMimeType(ext),
          size: stats.size,
          modified: stats.mtime.toISOString()
        });
      }
    }

    return mediaFiles;
  }

  async deleteMedia(filename: string): Promise<boolean> {
    const fullPath = path.join(this.notesDirectory, filename);
    
    // LOCK ONLY for the file deletion
    await this.lockManager.withLock(fullPath, async () => {
      await fs.unlink(fullPath);
    });
    
    return true;
  }

  async listAllMedia(): Promise<MediaFile[]> {
    const allMedia: MediaFile[] = [];
    
    // Check main directory
    const mainFiles = await fs.readdir(this.notesDirectory);
    for (const file of mainFiles) {
      if (!file.endsWith('.txt') && !this.isSystemFile(file)) {
        const fullPath = path.join(this.notesDirectory, file);
        const stats = await fs.stat(fullPath);
        
        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          allMedia.push({
            filename: file,
            mimeType: this.getMimeType(ext),
            size: stats.size,
            modified: stats.mtime.toISOString()
          });
        }
      }
    }
    
    // Check inbox
    const inboxFiles = await fs.readdir(this.inboxPath);
    for (const file of inboxFiles) {
      if (!file.endsWith('.txt')) {
        const fullPath = path.join(this.inboxPath, file);
        const stats = await fs.stat(fullPath);
        
        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          allMedia.push({
            filename: `inbox/${file}`,
            mimeType: this.getMimeType(ext),
            size: stats.size,
            modified: stats.mtime.toISOString()
          });
        }
      }
    }
    
    return allMedia;
  }

  extractNoteBaseFromMedia(mediaFilename: string): string | null {
    // Pattern: [note-base]-[type]-[index].[ext]
    const match = mediaFilename.match(/^(.+?)-(image|audio|video|file)-\d+\.[^.]+$/);
    if (match) {
      return match[1];
    }
    
    // Legacy pattern: just remove extension
    const base = path.basename(mediaFilename);
    const extIndex = base.lastIndexOf('.');
    if (extIndex > 0) {
      return base.substring(0, extIndex);
    }
    
    return null;
  }

  // ============================================================================
  // APP STATE OPERATIONS
  // ============================================================================

  async getPinnedItems(): Promise<{ notes: string[], concepts: string[] }> {
    try {
      const prefsPath = path.join(this.metadataPath, 'preferences.json');
      const data = await fs.readFile(prefsPath, 'utf8');
      const prefs = JSON.parse(data);
      return prefs.pinned || { notes: [], concepts: [] };
    } catch {
      return { notes: [], concepts: [] };
    }
  }

  async pinItem(type: 'note' | 'concept', name: string): Promise<boolean> {
    try {
      const prefsPath = path.join(this.metadataPath, 'preferences.json');
      let prefs: any = {};
      
      try {
        const data = await fs.readFile(prefsPath, 'utf8');
        prefs = JSON.parse(data);
      } catch {
        // File doesn't exist, start fresh
      }

      if (!prefs.pinned) {
        prefs.pinned = { notes: [], concepts: [] };
      }

      const items = type === 'note' ? prefs.pinned.notes : prefs.pinned.concepts;
      if (!items.includes(name)) {
        items.push(name);
        await fs.writeFile(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
      }

      return true;
    } catch (error) {
      // Error pinning item
      return false;
    }
  }

  async unpinItem(type: 'note' | 'concept', name: string): Promise<boolean> {
    try {
      const prefsPath = path.join(this.metadataPath, 'preferences.json');
      const data = await fs.readFile(prefsPath, 'utf8');
      const prefs = JSON.parse(data);

      if (prefs.pinned) {
        const items = type === 'note' ? prefs.pinned.notes : prefs.pinned.concepts;
        const index = items.indexOf(name);
        if (index > -1) {
          items.splice(index, 1);
          await fs.writeFile(prefsPath, JSON.stringify(prefs, null, 2), 'utf8');
        }
      }

      return true;
    } catch (error) {
      // Error unpinning item
      return false;
    }
  }

  async getRecentNotes(limit = 5): Promise<Note[]> {
    try {
      // Only include main notes, exclude inbox/ideas
      const notes = await this.listNotes('notes');
      
      // Sort by modified date descending
      return notes
        .sort((a: Note, b: Note) => new Date(b.metadata.modified || 0).getTime() - 
                       new Date(a.metadata.modified || 0).getTime())
        .slice(0, limit);
    } catch (error) {
      // Error getting recent notes
      return [];
    }
  }

  // ============================================================================
  // MISSING IPC METHODS - Fix interface consistency
  // ============================================================================

  async validateAndRepairIntegrity(): Promise<ValidationReport> {
    return await this.relations.validateRelations();
  }

  async getNotesForConcept(conceptName: string): Promise<string[]> {
    try {
      const concept = await this.getConcept(conceptName);
      return concept.metadata.linkedNotes || [];
    } catch {
      return [];
    }
  }

  async getConceptsForNote(filename: string): Promise<string[]> {
    try {
      const note = await this.loadNote(filename);
      return note.metadata.concepts || [];
    } catch {
      return [];
    }
  }

  // ============================================================================
  // SEARCH OPERATIONS
  // ============================================================================

  async searchNotes(
    query: string, 
    options?: { 
      includeInbox?: boolean; 
      concepts?: string[]; 
      sortBy?: 'modified' | 'created' | 'title' 
    }
  ): Promise<Note[]> {
    const location = options?.includeInbox ? 'all' : 'notes';
    // Get notes as simple array
    const notes = await this.listNotes(location);
    
    let filtered = notes.filter((note: Note) => {
      const searchIn = `${note.metadata.title || ''} ${note.content}`.toLowerCase();
      if (!searchIn.includes(query.toLowerCase())) return false;

      if (options?.concepts?.length) {
        const noteConcepts = note.metadata.concepts || [];
        // Case-insensitive concept matching
        const lowerConcepts = options.concepts.map((c: string) => c.toLowerCase());
        if (!noteConcepts.some((c: string) => lowerConcepts.includes(c.toLowerCase()))) return false;
      }

      return true;
    });

    // Sort results
    if (options?.sortBy) {
      filtered.sort((a: Note, b: Note) => {
        switch (options.sortBy) {
          case 'title':
            return (a.metadata.title || a.filename).localeCompare(b.metadata.title || b.filename);
          case 'created':
            return new Date(b.metadata.created || 0).getTime() - new Date(a.metadata.created || 0).getTime();
          case 'modified':
          default:
            return new Date(b.metadata.modified || 0).getTime() - new Date(a.metadata.modified || 0).getTime();
        }
      });
    }

    return filtered;
  }

  parseContent(content: string): ParsedContent {
    const concepts: string[] = [];
    const noteLinks: string[] = [];
    const externalLinks: string[] = [];

    // Find all #concept mentions (hashtag style)
    const conceptMatches = content.matchAll(/#([a-zA-Z0-9-_]+)/g);
    for (const match of conceptMatches) {
      concepts.push(match[1]);
    }

    // Find all @note mentions (at-mention style)
    const noteMatches = content.matchAll(/@([a-zA-Z0-9-_]+)/g);
    for (const match of noteMatches) {
      noteLinks.push(match[1]);
    }

    // Find markdown-style internal links [[note-name]]
    const markdownNoteMatches = content.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of markdownNoteMatches) {
      noteLinks.push(match[1]);
    }

    // Find external links (both bare URLs and markdown links)
    const urlMatches = content.matchAll(/https?:\/\/[^\s\)]+/g);
    for (const match of urlMatches) {
      externalLinks.push(match[0]);
    }

    // Find markdown-style external links [text](url)
    const markdownLinkMatches = content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g);
    for (const match of markdownLinkMatches) {
      externalLinks.push(match[2]);
    }

    return {
      concepts: [...new Set(concepts)],
      noteLinks: [...new Set(noteLinks)],
      externalLinks: [...new Set(externalLinks)]
    };
  }



  // ============================================================================
  // SIMPLE HELPER METHODS
  // ============================================================================

  async fileExists(filepath: string): Promise<boolean> {
    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  private async listTextFiles(directory: string): Promise<string[]> {
    try {
      const files = await fs.readdir(directory);
      return files.filter(f => f.endsWith('.txt'));
    } catch {
      return [];
    }
  }

  private async renameAssociatedMediaFiles(oldFilename: string, newFilename: string, baseDir: string): Promise<void> {
    const oldBase = path.basename(oldFilename, '.txt');
    const newBase = path.basename(newFilename, '.txt');
    
    try {
      const files = await fs.readdir(baseDir);
      for (const file of files) {
        if (file.startsWith(oldBase) && !file.endsWith('.txt')) {
          const ext = path.extname(file);
          const suffix = file.substring(oldBase.length, file.length - ext.length);
          const newMediaName = `${newBase}${suffix}${ext}`;
          
          const oldPath = path.join(baseDir, file);
          const newPath = path.join(baseDir, newMediaName);
          await fs.rename(oldPath, newPath);
        }
      }
    } catch (error) {
      // Error renaming associated media files
    }
  }

  private getMediaTypeFromMime(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    return 'file';
  }

  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown'
    };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  private isSystemFile(filename: string): boolean {
    return filename.startsWith('.') || 
           filename === 'desktop.ini' || 
           filename === 'Thumbs.db' ||
           filename.endsWith('.tmp');
  }
}

