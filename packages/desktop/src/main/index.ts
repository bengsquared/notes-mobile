import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { createServer } from 'http';
import Store from 'electron-store';
import { promises as fs } from 'fs';
import { NotesStorage } from '../lib/storage';
import { IPCHandlers } from './ipc-handlers';
import { NotesMCPServer } from './mcp-server';
import os from 'os';
import { Bonjour } from 'bonjour-service';

const { join } = path;

// Check if we're in MCP mode early
const isMCPMode = process.env.ENABLE_MCP_SERVER === 'true' || process.argv.includes('--mcp');

// Create a logger that's silent in MCP mode or logs to file
const logger = {
  log: (...args: any[]) => {
    if (!isMCPMode) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    if (!isMCPMode) {
      console.error(...args);
    }
  }
};

// Disable sandbox in development mode (only when not in MCP mode)
const isDev = process.env.NODE_ENV !== 'production';
if (isDev && !isMCPMode) {
  app.commandLine.appendSwitch('--no-sandbox');
  logger.log('Development mode: Sandbox disabled');
}

const store = new Store({
  name: 'notes-app-config' // Use consistent name for both dev and production
});
let mainWindow: typeof BrowserWindow.prototype | null = null;
let currentPIN: string | null = null;
let pinExpiryTimeout: NodeJS.Timeout | null = null;
let storage: NotesStorage | null = null;
let mcpServer: NotesMCPServer | null = null;
let bonjour: any = null;
let rpcServer: any = null;

// WebRTC connections by code
let webrtcConnections = new Map<string, {
  peerConnection: any,
  code: string,
  timestamp: number
}>();

// Store for pending transfer codes (maps code to notes data)
const pendingTransfers = new Map<string, { notes: any[], timestamp: number }>();

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: join(__dirname, '../../resources/logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js')
    }
  });

  // In development, Vite will provide the dev server
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Generate a 6-digit PIN
function generatePIN(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate new PIN with 5-minute expiry
function generateTransferPIN(): string {
  // Clear any existing timeout
  if (pinExpiryTimeout) {
    logger.log(`🧹 Clearing existing PIN timeout`);
    clearTimeout(pinExpiryTimeout);
  }
  
  currentPIN = generatePIN();
  logger.log(`🔢 New PIN generated: ${currentPIN}`);
  
  // Set PIN to expire after 5 minutes
  pinExpiryTimeout = setTimeout(() => {
    logger.log(`⏰ PIN ${currentPIN} expired after 5 minutes`);
    currentPIN = null;
    mainWindow?.webContents.send('pin-expired');
  }, 5 * 60 * 1000);
  
  logger.log(`⏱️ PIN will expire in 5 minutes`);
  return currentPIN;
}

// Validate PIN
function validatePIN(pin: string): boolean {
  return currentPIN !== null && currentPIN === pin;
}

function setupRPCServer() {
  // Get local IP address
  const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
      const networkInterface = interfaces[interfaceName];
      if (networkInterface) {
        for (const iface of networkInterface) {
          if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address;
          }
        }
      }
    }
    return '127.0.0.1';
  };

  const localIP = getLocalIP();
  
  rpcServer = createServer((req: any, res: any) => {
    // Set CORS headers for cross-origin requests from web apps
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Handle discovery endpoint for web apps to find this desktop
    if (req.method === 'GET' && req.url === '/discover') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        service: 'notes-app', 
        version: '1.0.0',
        hostname: os.hostname(),
        ip: localIP,
        hasActivePIN: currentPIN !== null
      }));
      return;
    }

    if (req.method === 'POST' && req.url === '/rpc') {
      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk.toString();
      });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          logger.log(`📥 Received RPC request body: ${body}`);
          logger.log(`🔑 Current PIN state: ${currentPIN ? `Active (${currentPIN})` : 'None'}`);
          logger.log(`📨 RPC Request: ${data.method} (ID: ${data.id})`);
          
          // Handle ping method
          if (data.method === 'ping') {
            logger.log(`🏓 Ping received, responding with pong`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', result: 'pong', id: data.id }));
          } 
          // Handle getTransferPIN method - generates and returns a new PIN
          else if (data.method === 'getTransferPIN') {
            const pin = generateTransferPIN();
            logger.log(`🔢 Generated new transfer PIN: ${pin} (expires in 5 minutes)`);
            mainWindow?.webContents.send('transfer-pin-generated', pin);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', result: { pin, expiresIn: 300 }, id: data.id }));
          }
          // Handle direct transfer with connection code
          else if (data.method === 'transferNotesWithCode' && data.params?.code && data.params?.notes !== undefined) {
            const { code, notes } = data.params;
            logger.log(`🔐 Transfer request with code: ${code}, notes: ${notes.length}, current PIN: ${currentPIN}`);
            
            // Check if code matches current PIN
            if (currentPIN !== code) {
              logger.error(`❌ Invalid connection code provided: ${code} (expected: ${currentPIN})`);
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32002, message: 'Invalid connection code' }, id: data.id }));
              return;
            }

            try {
              // If notes array is empty, this is just a validation request
              if (notes.length === 0) {
                logger.log(`✅ Connection code ${code} validated successfully (validation request)`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ jsonrpc: '2.0', result: { success: true, validated: true }, id: data.id }));
                return;
              }

              logger.log(`📝 Processing transfer of ${notes.length} notes with code ${code}`);
              
              // Save notes as ideas
              if (storage) {
                logger.log(`💾 Saving ${notes.length} notes as ideas to storage`);
                let savedCount = 0;
                for (const note of notes) {
                  try {
                    // Create a title from the note content (first 50 chars, cleaned up)
                    const title = note.content
                      .trim()
                      .substring(0, 50)
                      .replace(/[\r\n]+/g, ' ')
                      .trim();
                    
                    // Prepare the content with location info if available
                    let enrichedContent = note.content;
                    if (note.location && note.location.lat && note.location.lng) {
                      const { lat, lng } = note.location;
                      const mapsUrl = `https://maps.google.com/maps?q=${lat},${lng}`;
                      const locationInfo = `\n\n📍 **Location**: [${lat.toFixed(6)}, ${lng.toFixed(6)}](${mapsUrl})`;
                      enrichedContent = note.content + locationInfo;
                      logger.log(`  📍 Adding location data: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                    }
                    
                    await storage.createIdea(enrichedContent, {
                      title: title || 'Transferred note',
                      created: note.createdAt || new Date().toISOString(),
                      processed: false
                    });
                    savedCount++;
                    logger.log(`  ✓ Saved note ${savedCount}/${notes.length}: "${title}"`);
                  } catch (error) {
                    logger.error(`  ❌ Error saving note ${savedCount + 1}/${notes.length}:`, error);
                  }
                }
                logger.log(`💾 Successfully saved ${savedCount}/${notes.length} notes as ideas`);
              } else {
                logger.error(`❌ Storage not available! Cannot save notes.`);
              }
              
              // Process notes with media for any additional handling
              const processedNotes = notes.map((note: any) => ({
                ...note,
                media: note.media || []
              }));
              
              logger.log(`📢 Sending notes-received event to renderer process`);
              mainWindow?.webContents.send('notes-received', processedNotes);
              
              // Clear PIN after successful transfer (only for actual transfers, not validation)
              logger.log(`🧹 Clearing PIN after successful transfer`);
              currentPIN = null;
              if (pinExpiryTimeout) {
                clearTimeout(pinExpiryTimeout);
                pinExpiryTimeout = null;
              }
              
              logger.log(`✅ Transfer completed successfully: ${notes.length} notes received`);
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ jsonrpc: '2.0', result: { success: true, notesReceived: notes.length }, id: data.id }));
              
            } catch (error) {
              logger.error(`❌ Error processing transfer:`, error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Failed to process transfer' }, id: data.id }));
            }
          }
          // Handle transferNotes method with PIN validation
          else if (data.method === 'transferNotes' && data.params?.notes) {
            // Check if PIN is provided and valid
            if (!data.params.pin) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'PIN required' }, id: data.id }));
              return;
            }
            
            if (!validatePIN(data.params.pin)) {
              res.writeHead(401, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32002, message: 'Invalid or expired PIN' }, id: data.id }));
              return;
            }
            
            logger.log('Received notes from web app via PIN transfer');
            
            // Save each note as an idea (since they come from web/mobile)
            if (storage) {
              logger.log(`Saving ${data.params.notes.length} notes as ideas`);
              
              for (let i = 0; i < data.params.notes.length; i++) {
                const note = data.params.notes[i];
                try {
                  // Save as idea (unprocessed thought from web/mobile)
                  await storage.createIdea(note.content, {
                    created: note.createdAt || new Date().toISOString(),
                    processed: false
                  });
                } catch (error) {
                  logger.error(`Error saving note ${i + 1} as idea:`, error);
                }
              }
              
              logger.log('Finished saving all notes as ideas');
            } else {
              logger.error('Storage is not available! Cannot save notes.');
            }
            
            // Process notes with media for any additional handling
            const processedNotes = data.params.notes.map((note: any) => ({
              ...note,
              media: note.media || []
            }));
            
            mainWindow?.webContents.send('notes-received', processedNotes);
            
            // Clear PIN after successful transfer
            currentPIN = null;
            if (pinExpiryTimeout) {
              clearTimeout(pinExpiryTimeout);
              pinExpiryTimeout = null;
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', result: { success: true, notesReceived: data.params.notes.length }, id: data.id }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: data.id }));
          }
        } catch (error) {
          logger.error('❌ RPC parsing/processing error:', error);
          logger.error('📋 Request body that caused error:', body);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  rpcServer.listen(8080, '0.0.0.0', () => {
    logger.log(`🚀 RPC server listening on ${localIP}:8080`);
    logger.log(`🔑 Initial PIN state: ${currentPIN ? `Active (${currentPIN})` : 'None'}`);
    
    // Set up mDNS service advertisement
    if (!bonjour) {
      bonjour = new Bonjour();
    }
    
    // Advertise the notes transfer service
    const service = bonjour.publish({
      name: `Notes-${os.hostname()}`,
      type: 'notes-transfer',
      port: 8080,
      txt: {
        version: '1.0.0',
        hostname: os.hostname(),
        ip: localIP
      }
    });
    
    logger.log(`mDNS service advertised: Notes-${os.hostname()}._notes-transfer._tcp.local`);
    
    service.on('up', () => {
      logger.log('mDNS service is up and running');
    });
    
    service.on('error', (err: any) => {
      logger.error('mDNS service error:', err);
    });
  });
}

// Handle MCP mode vs normal Electron app mode
if (isMCPMode) {
  // In MCP mode, skip Electron initialization and run MCP server directly
  initializeMCPServerStandalone().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
} else {
  // Normal Electron app mode
  app.whenReady().then(async () => {
    // Register essential IPC handlers first
    registerTransferHandlers();
    
    await initializeStorage();
    
    createWindow();
    setupRPCServer();
  });
}

// Only register app event handlers when not in MCP mode
if (!isMCPMode) {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    // Clean up services
    if (bonjour) {
      bonjour.destroy();
      bonjour = null;
    }
    
    if (rpcServer) {
      rpcServer.close();
      rpcServer = null;
    }
    
    if (pinExpiryTimeout) {
      clearTimeout(pinExpiryTimeout);
      pinExpiryTimeout = null;
    }
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
}

// Initialize storage on startup
async function initializeStorage() {
  const isMCPMode = process.env.ENABLE_MCP_SERVER === 'true' || process.argv.includes('--mcp');
  
  logger.log('🗄️ Initializing storage...');
  
  // Initialize storage system with DeepNotes directory
  const documentsPath = app.getPath('documents');
  const notesDirectory = path.join(documentsPath, 'DeepNotes');
  
  storage = new NotesStorage(notesDirectory);
  await storage.initialize();
  
  // Set up IPC handlers
  new IPCHandlers(storage);
  
  logger.log('🗄️ Storage initialized successfully');
  
  // Validate integrity
  const integrity = await storage.validateAndRepairIntegrity();
  if (integrity.issues && integrity.issues.length > 0) {
    logger.log(`🔧 Found ${integrity.issues.length} integrity issues`);
  }
  
  // Initialize MCP server if in MCP mode
  if (isMCPMode) {
    await initializeMCPServer();
  }
}

// Initialize MCP server
async function initializeMCPServer() {
  if (!mcpServer) {
    try {
      mcpServer = new NotesMCPServer();
      if (storage) {
        mcpServer.setNotesStorage(storage);
      }
      await mcpServer.start();
      logger.log('MCP Server initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MCP Server:', error);
    }
  }
}

// Initialize MCP server in standalone mode (without Electron app)
async function initializeMCPServerStandalone() {
  try {
    // Silence console output in MCP mode to prevent JSON-RPC interference
    const originalConsole = { ...console };
    console.log = () => {};
    console.warn = () => {};
    console.error = (...args) => originalConsole.error(...args); // Keep errors for debugging
    
    // Initialize storage directly without app.getPath 
    const os = require('os');
    const documentsPath = path.join(os.homedir(), 'Documents');
    const notesDirectory = path.join(documentsPath, 'DeepNotes');
    
    storage = new NotesStorage(notesDirectory);
    await storage.initialize();
    
    // Initialize MCP server
    mcpServer = new NotesMCPServer();
    mcpServer.setNotesStorage(storage);
    await mcpServer.start();
    
    console.error('Notes MCP Server started on stdio');
    
    // Keep process alive and handle cleanup
    process.on('SIGINT', () => {
      console.error('MCP Server shutting down...');
      process.exit(0);
    });
    
  } catch (error) {
    throw new Error(`Failed to initialize standalone MCP server: ${error}`);
  }
}

// Generate MCP configuration for Claude Desktop
async function generateMCPConfig() {
  try {
    const appPath = app.getPath('exe');
    const configPath = getClaudeDesktopConfigPath();
    
    // Check if we're in development (Electron binary) or production (app bundle)
    const isDev = appPath.includes('node_modules') || appPath.includes('Electron.app');
    
    let mcpConfig: { mcpServers: { [key: string]: { command: string; args: string[]; description: string } } };
    if (isDev) {
      // Development: Use electron command with the built main file and --mcp flag
      const mainPath = path.join(__dirname, 'index.js');
      mcpConfig = {
        mcpServers: {
          "notes-app": {
            command: appPath,
            args: [mainPath, "--mcp"],
            description: "Personal notes management with AI-powered search and analysis (Development)"
          }
        }
      };
    } else {
      // Production: Use the app bundle with --mcp flag
      mcpConfig = {
        mcpServers: {
          "notes-app": {
            command: appPath,
            args: ["--mcp"],
            description: "Personal notes management with AI-powered search and analysis"
          }
        }
      };
    }

    const configInstructions = `
# Claude Desktop MCP Configuration for Notes App

To add the Notes app to Claude Desktop, add this to your Claude Desktop configuration file:

File location: ${configPath}

Configuration to add:
${JSON.stringify(mcpConfig, null, 2)}

# Instructions:
1. Open or create the Claude Desktop configuration file at the path above
2. If the file exists, merge the "notes-app" entry into the existing "mcpServers" object
3. If the file doesn't exist, create it with the full configuration above
4. Restart Claude Desktop to load the new MCP server

# Alternative: Copy this entire configuration to clipboard
`;

    // Save instructions to desktop
    const desktopPath = app.getPath('desktop');
    const instructionsPath = path.join(desktopPath, 'Notes-App-MCP-Setup.txt');
    
    await fs.writeFile(instructionsPath, configInstructions, 'utf8');
    
    logger.log(`MCP setup instructions saved to: ${instructionsPath}`);
    
    // Also try to update the Claude config directly if possible
    await updateClaudeConfigIfPossible(configPath, mcpConfig);
    
  } catch (error) {
    logger.error('Error generating MCP config:', error);
  }
}

function getClaudeDesktopConfigPath(): string {
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

async function updateClaudeConfigIfPossible(configPath: string, mcpConfig: any) {
  try {
    let existingConfig: any = {};
    
    // Try to read existing config
    try {
      const existingContent = await fs.readFile(configPath, 'utf8');
      existingConfig = JSON.parse(existingContent);
    } catch {
      // File doesn't exist or is invalid, start fresh
      existingConfig = { mcpServers: {} };
    }
    
    // Ensure mcpServers exists
    if (!existingConfig.mcpServers) {
      existingConfig.mcpServers = {};
    }
    
    // Add or update our server
    existingConfig.mcpServers['notes-app'] = mcpConfig.mcpServers['notes-app'];
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    
    // Write updated config
    await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2), 'utf8');
    
    logger.log('Successfully updated Claude Desktop configuration');
    
  } catch (error) {
    logger.log('Could not automatically update Claude config (this is normal):', error.message);
  }
}

// Storage directory handlers (only in normal Electron mode)
if (!isMCPMode) {
  ipcMain.handle('get-storage-config', () => {
    const notesDirectory = store.get('notesDirectory') as string | undefined;
    return {
      notesDirectory: notesDirectory || null,
      initialized: !!notesDirectory
    };
  });

  ipcMain.handle('generate-mcp-config', async () => {
    await generateMCPConfig();
    return true;
  });

  ipcMain.handle('select-notes-directory', async () => {
    logger.log("here")
    logger.log('Main: select-notes-directory called');
    logger.log('Main: Platform:', process.platform);
    logger.log('Main: Electron version:', process.versions.electron);
    
    try {
      // First, try to access the file system to trigger permissions
      const homePath = app.getPath('home');
      logger.log('Main: Home path:', homePath);
      
      try {
        // List home directory to trigger file access permission
        const homeContents = await fs.readdir(homePath);
        logger.log('Main: Successfully read home directory, found', homeContents.length, 'items');
        
        // Also try Documents folder
        const documentsPath = app.getPath('documents');
        await fs.access(documentsPath);
        logger.log('Main: Documents folder accessible at:', documentsPath);
      } catch (fsError) {
        logger.error('Main: File system access error:', fsError);
        logger.log('Main: This might trigger macOS permission dialog...');
      }
    
      
      // For now, just use the fixed DeepNotes directory
      const defaultPath = path.join(app.getPath('documents'), 'DeepNotes');
      logger.log('Main: Using default DeepNotes directory:', defaultPath);
      
      return defaultPath;
    } catch (error) {
      logger.error('Main: Dialog error:', error);
      return null;
    }
  });
}


// Register transfer-related IPC handlers
function registerTransferHandlers() {
  ipcMain.handle('generate-transfer-pin', () => {
    logger.log('🎯 IPC: generate-transfer-pin called from renderer');
    const pin = generateTransferPIN();
    logger.log('📡 IPC: Sending transfer-pin-generated event to renderer');
    mainWindow?.webContents.send('transfer-pin-generated', pin);
    logger.log('🔄 IPC: Returning PIN to renderer');
    return pin;
  });

  ipcMain.handle('get-current-pin', () => {
    logger.log(`🎯 IPC: get-current-pin called, returning: ${currentPIN}`);
    return currentPIN;
  });

  ipcMain.handle('clear-transfer-pin', () => {
    logger.log('🎯 IPC: clear-transfer-pin called');
    if (pinExpiryTimeout) {
      logger.log('🧹 IPC: Clearing PIN timeout');
      clearTimeout(pinExpiryTimeout);
      pinExpiryTimeout = null;
    }
    currentPIN = null;
    logger.log('🧹 IPC: PIN cleared');
    return true;
  });
}

// Additional IPC handlers (only in normal Electron mode)
if (!isMCPMode) {
  ipcMain.handle('getStorageConfig', () => {
    return {
      notesDirectory: app.getPath('documents') + '/DeepNotes',
      backupEnabled: store.get('backup.enabled', false),
      indexingEnabled: store.get('indexing.enabled', true)
    };
  });

  ipcMain.handle('generateMCPConfig', async () => {
    try {
      const documentsPath = app.getPath('documents');
      const configPath = path.join(documentsPath, 'claude_desktop_config.json');
      
      const config = {
        mcpServers: {
          "notes-app": {
            command: process.execPath,
            args: [
              path.join(__dirname, '../../main/index.js'),
              '--mcp'
            ],
            env: {
              ENABLE_MCP_SERVER: 'true'
            }
          }
        }
      };
      
      await fs.writeFile(configPath, JSON.stringify(config, null, 2));
      logger.log(`MCP config written to: ${configPath}`);
      return true;
    } catch (error) {
      logger.error('Failed to generate MCP config:', error);
      return false;
    }
  });
}