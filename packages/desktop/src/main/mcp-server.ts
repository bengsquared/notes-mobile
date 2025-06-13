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
import { createWriteStream } from 'fs';
import { toolLogicRegistry, allTools, getEnhancedErrorMessage } from './tools';

export class NotesMCPServer {
  private server: Server;
  private notesStorage: NotesStorage | null = null;
  private store: Store;
  private logStream: any = null;

  constructor() {
    this.store = new Store({
      name: 'notes-app-config' // Use consistent name for both dev and production
    });

    // Set up file logging for MCP mode
    const logPath = path.join(os.homedir(), '.notes-mcp-server.log');
    this.logStream = createWriteStream(logPath, { flags: 'a' });
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

    // Add global error handler - log to file to avoid interfering with JSON-RPC
    process.on('uncaughtException', (error) => {
      this.logToFile(`Uncaught exception: ${error.stack || error}`);
    });

    process.on('unhandledRejection', (reason) => {
      this.logToFile(`Unhandled rejection: ${reason}`);
    });

    this.setupHandlers();
  }

  setNotesStorage(storage: NotesStorage) {
    this.notesStorage = storage;
  }

  private logToFile(message: string) {
    if (this.logStream) {
      this.logStream.write(`${new Date().toISOString()} ${message}\n`);
    }
  }

  private createErrorResponse(message: string, toolName?: string) {
    const enhancedMessage = toolName
      ? getEnhancedErrorMessage(toolName, message)
      : message;

    return {
      content: [
        {
          type: 'text',
          text: enhancedMessage,
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
      // Debug: log any null or undefined tools
      const nulls = allTools
        .map((tool, i) => (tool == null ? i : null))
        .filter(i => i !== null);
      if (nulls.length > 0) {
        this.logToFile(`Null/undefined tool indices: ${nulls.join(', ')}`);
      }
      return {
        tools: allTools
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
        const logic = toolLogicRegistry[name];
        if (!logic) {
          return this.createErrorResponse(`Unknown tool: ${name}`);
        }
        // Dependency injection for tool logic
        // Pass store, notesStorage, createSuccessResponse, etc. as needed
        // (This can be improved with a per-tool config, but for now, pass all common deps)
        const deps = {
          store: this.store,
          notesStorage: this.notesStorage,
          createSuccessResponse: this.createSuccessResponse.bind(this),
          app,
          path,
          getClaudeDesktopConfigPath: this.getClaudeDesktopConfigPath?.bind(this),
        };
        // Call the tool logic with dependencies and arguments
        // Most tool logic expects (notesStorage, ...args) or similar
        // We'll try to call with (deps, ...Object.values(args))
        // If args is an object, spread its values; else, pass as single arg
        let result;
        if (!this.notesStorage && name !== 'get_storage_config' && name !== 'configure_notes_directory' && name !== 'generate_mcp_configuration') {
          return this.createErrorResponse('Notes storage not initialized. Use configure_notes_directory to set up a notes directory first.', name);
        }
        if (typeof logic === 'function') {
          // Try to call with all dependencies and arguments
          // (This can be improved with a per-tool signature map)
          result = await logic(
            deps.notesStorage,
            ...(Array.isArray(args) ? args : args ? Object.values(args) : []),
            deps.createSuccessResponse,
            deps.store,
            deps.app,
            deps.path,
            deps.getClaudeDesktopConfigPath
          );
        } else {
          return this.createErrorResponse(`Tool logic for '${name}' is not a function.`);
        }
        return result;
      } catch (error) {
        return this.createErrorResponse(`Error executing ${request?.params?.name}: ${error instanceof Error ? error.message : String(error)}`, request?.params?.name);
      }
    });
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
      const isPackaged = app.isPackaged;

      let mcpConfig;
      let setupInstructions;

      if (isPackaged) {
        // Production: Use the packaged app bundle directly
        mcpConfig = {
          mcpServers: {
            "notes-app": {
              type: "stdio",
              command: appPath,
              args: ["--mcp"],
              env: {
                NODE_ENV: "production"
              },
              description: "Personal notes management with AI-powered search, ideas inbox, and concept mapping"
            }
          }
        };

        setupInstructions = `Production/Packaged App Configuration:
1. The app is installed at: ${appPath}
2. Use the configuration above in your Claude Desktop config
3. The app will run in headless MCP mode when launched with --mcp flag`;

      } else {
        // Development: Need to use electron binary with the built files
        const projectRoot = path.resolve(__dirname, '../../../..');
        const electronBinary = path.join(projectRoot, 'node_modules/.bin/electron');
        const mainFile = path.join(__dirname, 'index.js');

        mcpConfig = {
          mcpServers: {
            "notes-app": {
              type: "stdio",
              command: electronBinary,
              args: [mainFile, "--mcp"],
              env: {
                NODE_ENV: "development"
              },
              description: "Personal notes management with AI-powered search, ideas inbox, and concept mapping (Development)"
            }
          }
        };

        setupInstructions = `Development Configuration:
1. First run "pnpm build" to build the app
2. Use the configuration above in your Claude Desktop config
3. The electron binary is at: ${electronBinary}
4. The main file is at: ${mainFile}

For production use, run "pnpm dist" to create a packaged app, then use generate_mcp_configuration again from the packaged app.`;
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

${setupInstructions}

General Setup Instructions:
1. Open or create the Claude Desktop configuration file at the path above
2. If the file exists, merge the "notes-app" entry into the existing "mcpServers" object
3. If the file doesn't exist, create it with the full configuration above
4. Restart Claude Desktop to load the new MCP server

Mode: ${isPackaged ? 'Production/Packaged' : 'Development'}
App Path: ${appPath}`,
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

  async start() {
    try {
      const transport = new StdioServerTransport();

      // Add error handling for transport
      transport.onerror = (error: any) => {
        this.logToFile(`MCP Transport error: ${error}`);
        this.cleanup();
      };

      await this.server.connect(transport);

      // Add error handling for the server
      this.server.onerror = (error: any) => {
        this.logToFile(`MCP Server error: ${error}`);
        this.cleanup();
      };

      // Handle process signals for clean shutdown
      process.on('SIGINT', () => {
        this.logToFile('Received SIGINT, shutting down gracefully...');
        this.cleanup();
        process.exit(0);
      });

      process.on('SIGTERM', () => {
        this.logToFile('Received SIGTERM, shutting down gracefully...');
        this.cleanup();
        process.exit(0);
      });

      // Handle stdio close/end events
      process.stdin.on('end', () => {
        this.logToFile('STDIN ended, client disconnected - shutting down...');
        this.cleanup();
        process.exit(0);
      });

      process.stdin.on('close', () => {
        this.logToFile('STDIN closed, client disconnected - shutting down...');
        this.cleanup();
        process.exit(0);
      });

      this.logToFile('Notes MCP Server started on stdio');
    } catch (error) {
      this.logToFile(`Failed to start MCP server: ${error}`);
      throw error;
    }
  }

  private cleanup() {
    try {
      this.logToFile('MCP Server cleanup completed');
      if (this.logStream) {
        this.logStream.end();
        this.logStream = null;
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}