import { ToolDefinition } from './types';
import type { NotesStorage, CreateSuccessResponse } from './types';

/**
 * Configuration and setup tools for the notes system
 * 
 * Example usage:
 * - get_storage_config: Check if notes directory is configured
 * - configure_notes_directory: Set up a new notes directory at "/Users/username/Documents/my-notes"
 * - generate_mcp_configuration: Get Claude Desktop config after app installation
 */
export const configTools: ToolDefinition[] = [
  {
    name: 'get_storage_config',
    description: 'Get current storage configuration status and directory path',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'configure_notes_directory',
    description: 'Set the notes directory path for the application',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path to the notes directory',
        },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'generate_mcp_configuration',
    description: 'Generate Claude Desktop MCP configuration for this app installation',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  }
];

export async function getStorageConfig(notesStorage: NotesStorage, createSuccessResponse: CreateSuccessResponse, store: any) {
  const notesDirectory = store.get('notesDirectory') as string | undefined;
  const config = {
    notesDirectory: notesDirectory || null,
    initialized: !!notesDirectory && !!notesStorage,
    status: notesDirectory
      ? (notesStorage ? 'ready' : 'directory_set_but_not_initialized')
      : 'not_configured'
  };
  return createSuccessResponse(config);
}

export async function configureNotesDirectory(path: string, store: any, NotesStorageClass: any) {
  try {
    const fs = require('fs').promises;
    await fs.access(path);
    store.set('notesDirectory', path);
    const notesStorage = new NotesStorageClass(path);
    await notesStorage.initialize();
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

export async function generateMCPConfiguration(app: any, path: any, store: any, getClaudeDesktopConfigPath: () => string) {
  try {
    const appPath = app.getPath('exe');
    const configPath = getClaudeDesktopConfigPath();
    const isPackaged = app.isPackaged;
    let mcpConfig;
    let setupInstructions;
    if (isPackaged) {
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
      setupInstructions = `Production/Packaged App Configuration:\n1. The app is installed at: ${appPath}\n2. Use the configuration above in your Claude Desktop config\n3. The app will run in headless MCP mode when launched with --mcp flag`;
    } else {
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
      setupInstructions = `Development Configuration:\n1. First run \"pnpm build\" to build the app\n2. Use the configuration above in your Claude Desktop config\n3. The electron binary is at: ${electronBinary}\n4. The main file is at: ${mainFile}\n\nFor production use, run \"pnpm dist\" to create a packaged app, then use generate_mcp_configuration again from the packaged app.`;
    }
    const configText = JSON.stringify(mcpConfig, null, 2);
    return {
      content: [
        {
          type: 'text',
          text: `Claude Desktop MCP Configuration Generated:\n\nFile location: ${configPath}\n\nConfiguration to add/merge:\n${configText}\n\n${setupInstructions}\n\nGeneral Setup Instructions:\n1. Open or create the Claude Desktop configuration file at the path above\n2. If the file exists, merge the \"notes-app\" entry into the existing \"mcpServers\" object\n3. If the file doesn't exist, create it with the full configuration above\n4. Restart Claude Desktop to load the new MCP server\n\nMode: ${isPackaged ? 'Production/Packaged' : 'Development'}\nApp Path: ${appPath}`,
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