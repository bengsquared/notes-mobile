#!/usr/bin/env node

import { NotesMCPServer } from './mcp-server';
import { NotesStorage } from '../lib/storage';
import path from 'path';

async function main() {
  // Get notes directory from command line argument or environment variable
  const notesDirectory = process.argv[2] || process.env.NOTES_DIRECTORY;
  
  if (!notesDirectory) {
    console.error('Usage: node mcp-standalone.js <notes-directory>');
    console.error('Or set NOTES_DIRECTORY environment variable');
    process.exit(1);
  }

  try {
    // Initialize storage
    const storage = new NotesStorage(notesDirectory);
    await storage.initialize();
    
    // Initialize and start MCP server
    const mcpServer = new NotesMCPServer();
    mcpServer.setNotesStorage(storage);
    await mcpServer.start();
    
    console.error(`Notes MCP Server started with directory: ${notesDirectory}`);
    
    // Keep the process alive
    process.on('SIGINT', () => {
      console.error('MCP Server shutting down...');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start MCP Server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}