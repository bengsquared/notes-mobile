import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface ToolDefinition extends Tool { }

export interface ToolCategory {
  name: string;
  description: string;
  tools: ToolDefinition[];
}

// --- Strong typing for tool logic ---
export interface NotesStorage {
  listNotes(type?: string): Promise<any[]>;
  loadNote(filename: string): Promise<any>;
  saveNote(filename: string, content: string, metadata?: any, location?: string): Promise<void>;
  deleteNote(filename: string): Promise<void>;
  createIdea(content: string, metadata?: any): Promise<any>;
  listConcepts(): Promise<any[]>;
  getConcept(name: string): Promise<any>;
  getNotesForConcept(conceptName: string): Promise<string[]>;
  listMediaForNote(noteFilename: string): Promise<any[]>;
  saveMedia(filename: string, data: string, mimeType: string): Promise<void>;
  loadMedia(filename: string): Promise<any>;
  deleteMedia(filename: string): Promise<void>;
  searchNotes(query: string, options?: any): Promise<any[]>;
  parseContent(content: string): any;
  getRecentNotes(limit?: number): Promise<any[]>;
  promoteIdeaToNote(ideaFilename: string, title: string, concepts?: string[]): Promise<any>;
}

export type CreateSuccessResponse = (data: any) => any;

export type ToolLogicFn = (...args: any[]) => Promise<any>;