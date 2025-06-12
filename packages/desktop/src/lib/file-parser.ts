import type { NoteMetadata, ParsedContent } from '@notes-app/shared';

const FRONTMATTER_DELIMITER = '---';

/**
 * File Parser - Handles parsing and formatting of note files
 * Pure functions with no external dependencies - perfect for modularization
 */
export class FileParser {
  /**
   * Parse file content into metadata and content
   */
  static parseFileContent(rawContent: string): { content: string; metadata: NoteMetadata } {
    const lines = rawContent.split('\n');
    let metadata: NoteMetadata = {};
    let contentStartIndex = 0;

    // Simple frontmatter parsing
    if (lines[0] === FRONTMATTER_DELIMITER) {
      const endIndex = lines.findIndex((line, idx) => idx > 0 && line === FRONTMATTER_DELIMITER);
      if (endIndex > 0) {
        contentStartIndex = endIndex + 1;
        metadata.concepts = [];
        metadata.links = [];
        metadata.title = '';
        
        // Parse YAML-style frontmatter
        for (let i = 1; i < endIndex; i++) {
          const line = lines[i].trim();
          if (line) {
            const [key, ...valueParts] = line.split(':');
            const value = valueParts.join(':').trim();
            
            switch (key.trim()) {
              case 'title':
                metadata.title = value;
                break;
              case 'concepts':
                metadata.concepts= metadata.concepts?.concat(this.parseArrayValue(value))
                break;
              case 'tags':
                metadata.concepts=metadata.concepts?.concat(this.parseArrayValue(value))
                break;
              case 'links':
                metadata.links = this.parseArrayValue(value);
                break;
              case 'relatedConcepts':
                const relatedConcepts = this.parseArrayValue(value);
                (metadata as any).relatedConcepts = relatedConcepts;
                break;
            }
          }
        }
      }
    }

    const content = lines.slice(contentStartIndex).join('\n').trim();
    
    // Auto-detect concepts and links from content if not in frontmatter
    if (!metadata.concepts || metadata.concepts.length === 0 || !metadata.links || metadata.links.length === 0) {
      const parsedContent = this.parseContent(content);
      if (!metadata.concepts || metadata.concepts.length === 0) {
        metadata.concepts = parsedContent.concepts;
      }
      if (!metadata.links || metadata.links.length === 0) {
        metadata.links = parsedContent.noteLinks;
      }
    }

    return { content, metadata };
  }

  /**
   * Format note content with frontmatter
   */
  static formatNoteContent(content: string, metadata?: NoteMetadata): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return content;
    }

    const frontmatter: string[] = [FRONTMATTER_DELIMITER];
    
    if (metadata.title) frontmatter.push(`title: ${metadata.title}`);
    if (metadata.concepts?.length) frontmatter.push(`concepts: [${metadata.concepts.join(', ')}]`);
    if (metadata.links?.length) frontmatter.push(`links: [${metadata.links.join(', ')}]`);
    if ((metadata as any).relatedConcepts?.length) frontmatter.push(`relatedConcepts: [${(metadata as any).relatedConcepts.join(', ')}]`);
    
    frontmatter.push(FRONTMATTER_DELIMITER);
    frontmatter.push('');
    frontmatter.push(content);

    return frontmatter.join('\n');
  }

  /**
   * Parse content for concepts, note links, and external links
   */
  static parseContent(content: string): ParsedContent {
    const concepts: string[] = [];
    const noteLinks: string[] = [];
    const externalLinks: string[] = [];

    // Find all #concept mentions
    const conceptMatches = content.matchAll(/#([a-zA-Z0-9-_]+)/g);
    for (const match of conceptMatches) {
      concepts.push(match[1]);
    }

    // Find all @note mentions and [[note-name]] style
    const noteMatches = content.matchAll(/@([a-zA-Z0-9-_]+)/g);
    for (const match of noteMatches) {
      noteLinks.push(match[1]);
    }

    const markdownNoteMatches = content.matchAll(/\[\[([^\]]+)\]\]/g);
    for (const match of markdownNoteMatches) {
      noteLinks.push(match[1]);
    }

    // Find external links
    const urlMatches = content.matchAll(/https?:\/\/[^\s\)]+/g);
    for (const match of urlMatches) {
      externalLinks.push(match[0]);
    }

    return {
      concepts: [...new Set(concepts)],
      noteLinks: [...new Set(noteLinks)],
      externalLinks: [...new Set(externalLinks)]
    };
  }

  /**
   * Parse array values from frontmatter
   */
  private static parseArrayValue(value: string): string[] {
    return value
      .replace(/[\[\]]/g, '')
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }
}