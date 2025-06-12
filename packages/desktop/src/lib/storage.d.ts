import type { Note, Concept, ConceptMetadata, MediaFile, ParsedContent, NoteMetadata } from '../../../shared/src/types';
export interface Idea {
    id: string;
    filename: string;
    content: string;
    metadata: NoteMetadata;
    created: string;
    modified: string;
    location: 'inbox';
}
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
export declare class RelationManager {
    private storage;
    constructor(storage: NotesStorage);
    addNoteConcept(noteFilename: string, conceptName: string): Promise<void>;
    removeNoteConcept(noteFilename: string, conceptName: string): Promise<void>;
    updateNoteConcepts(noteFilename: string, oldConcepts: string[], newConcepts: string[]): Promise<void>;
    validateRelations(): Promise<ValidationReport>;
    repairRelations(): Promise<{
        fixed: number;
        issues: string[];
    }>;
    resolveFilenameConflict(basename: string, extension?: string): Promise<string>;
    resolveMediaFilename(noteBase: string, mediaType: string, originalExt: string, index?: number): string;
}
export declare class NotesStorage {
    notesDirectory: string;
    private relationManager;
    private lockManager;
    constructor(notesDirectory: string);
    get relations(): RelationManager;
    private get inboxPath();
    private get conceptsPath();
    private get metadataPath();
    initialize(): Promise<void>;
    saveNote(filename: string, content: string, metadata?: NoteMetadata, location?: 'inbox' | 'notes'): Promise<boolean>;
    loadNote(filename: string): Promise<Note>;
    listNotes(location?: 'inbox' | 'notes' | 'all'): Promise<Note[]>;
    deleteNote(filename: string): Promise<boolean>;
    renameNote(oldFilename: string, newFilename: string): Promise<boolean>;
    checkFilenameUnique(filename: string, excludeFilename?: string): Promise<boolean>;
    noteExists(filename: string): Promise<boolean>;
    createConcept(conceptName: string): Promise<boolean>;
    listConcepts(): Promise<Concept[]>;
    getConcept(conceptName: string): Promise<Concept>;
    saveConcept(conceptName: string, content: string, metadata?: ConceptMetadata): Promise<boolean>;
    deleteConcept(conceptName: string): Promise<boolean>;
    updateConceptMetadata(conceptName: string, metadata: ConceptMetadata): Promise<void>;
    ensureConceptExists(conceptName: string): Promise<void>;
    createIdea(content: string, metadata?: Partial<NoteMetadata>): Promise<Idea>;
    listIdeas(): Promise<Idea[]>;
    updateIdea(filename: string, content: string, metadata?: Partial<NoteMetadata>): Promise<Idea>;
    loadIdea(filename: string): Promise<Idea>;
    deleteIdea(filename: string): Promise<void>;
    promoteIdeaToNote(ideaFilename: string, title: string, concepts?: string[]): Promise<Note>;
    saveMedia(filename: string, data: string | Buffer, mimeType?: string, noteFilename?: string): Promise<string>;
    loadMedia(filename: string): Promise<{
        data: string;
        mimeType: string;
    }>;
    listMediaForNote(noteFilename: string): Promise<MediaFile[]>;
    deleteMedia(filename: string): Promise<boolean>;
    listAllMedia(): Promise<MediaFile[]>;
    extractNoteBaseFromMedia(mediaFilename: string): string | null;
    getPinnedItems(): Promise<{
        notes: string[];
        concepts: string[];
    }>;
    pinItem(type: 'note' | 'concept', name: string): Promise<boolean>;
    unpinItem(type: 'note' | 'concept', name: string): Promise<boolean>;
    getRecentNotes(limit?: number): Promise<Note[]>;
    validateAndRepairIntegrity(): Promise<ValidationReport>;
    getNotesForConcept(conceptName: string): Promise<string[]>;
    getConceptsForNote(filename: string): Promise<string[]>;
    searchNotes(query: string, options?: {
        includeInbox?: boolean;
        concepts?: string[];
        sortBy?: 'modified' | 'created' | 'title';
    }): Promise<Note[]>;
    parseContent(content: string): ParsedContent;
    fileExists(filepath: string): Promise<boolean>;
    private listTextFiles;
    private renameAssociatedMediaFiles;
    private getMediaTypeFromMime;
    private getMimeType;
    private isSystemFile;
}
