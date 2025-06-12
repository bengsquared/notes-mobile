import type { NoteMetadata, ParsedContent } from '@notes-app/shared';
/**
 * File Parser - Handles parsing and formatting of note files
 * Pure functions with no external dependencies - perfect for modularization
 */
export declare class FileParser {
    /**
     * Parse file content into metadata and content
     */
    static parseFileContent(rawContent: string): {
        content: string;
        metadata: NoteMetadata;
    };
    /**
     * Format note content with frontmatter
     */
    static formatNoteContent(content: string, metadata?: NoteMetadata): string;
    /**
     * Parse content for concepts, note links, and external links
     */
    static parseContent(content: string): ParsedContent;
    /**
     * Parse array values from frontmatter
     */
    private static parseArrayValue;
}
