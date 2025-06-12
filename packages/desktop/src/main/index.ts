import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron';
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
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
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
let ipcHandlers: IPCHandlers | null = null;
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
    show: false, // Don't show until ready
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js')
    }
  });

  // Use app.isPackaged to determine if we're in production
  const isPackaged = app.isPackaged;
  
  if (!isPackaged && process.env.NODE_ENV !== 'production') {
    // Development mode - use Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
    // Show immediately in dev mode
    mainWindow.show();
  } else {
    // Production mode - load from built files
    const rendererPath = join(__dirname, '../renderer/index.html');
    logger.log('Loading renderer from path:', rendererPath);
    logger.log('App is packaged:', isPackaged);
    logger.log('__dirname:', __dirname);
    
    mainWindow.loadFile(rendererPath);
    
    // Disable dev tools in production
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        event.preventDefault();
      }
      if (input.key === 'F12') {
        event.preventDefault();
      }
    });
    
    // Debug: Log when page finishes loading
    mainWindow.webContents.once('did-finish-load', () => {
      logger.log('Renderer process finished loading');
      // Show window once content is loaded
      mainWindow?.show();
    });
    
    // Debug: Log any errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      logger.error('Failed to load renderer:', errorCode, errorDescription);
    });
    
    // Ensure dev tools are closed
    mainWindow.webContents.on('devtools-opened', () => {
      if (isPackaged && mainWindow) {
        mainWindow.webContents.closeDevTools();
      }
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Set up application menu with option to create new windows
function setupApplicationMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            createWindow();
          }
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];

  if (isMCPMode) {
    // Add MCP-specific menu items
    template.splice(1, 0, {
      label: 'MCP',
      submenu: [
        {
          label: 'MCP Server Status',
          enabled: false
        },
        {
          label: 'Running in background',
          enabled: false
        }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
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

  // Use different ports for dev/prod to avoid conflicts
  const rpcPort = isDev ? 8081 : 8080;
  
  rpcServer.listen(rpcPort, '0.0.0.0', () => {
    logger.log(`🚀 RPC server listening on ${localIP}:${rpcPort}`);
    logger.log(`🔑 Initial PIN state: ${currentPIN ? `Active (${currentPIN})` : 'None'}`);
    
    // Set up mDNS service advertisement
    if (!bonjour) {
      bonjour = new Bonjour();
    }
    
    // Advertise the notes transfer service
    const service = bonjour.publish({
      name: `Notes-${os.hostname()}${isDev ? '-dev' : ''}`,
      type: 'notes-transfer',
      port: rpcPort,
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

// Always run full Electron app, but skip initial window creation in MCP mode
app.whenReady().then(async () => {
  // Register essential IPC handlers first
  registerTransferHandlers();
  
  // Set up application menu
  setupApplicationMenu();
  
  // Create window immediately for faster startup (unless in MCP mode)
  if (!isMCPMode) {
    createWindow();
  } else {
    logger.log('🔧 MCP mode: App started without window. Use File > New Window or click dock icon to open interface.');
    
    // Set dock icon badge to indicate MCP mode
    if (process.platform === 'darwin') {
      app.dock?.setBadge('MCP');
    }
  }
  
  // Initialize storage and RPC server in background
  Promise.all([
    initializeStorage(),
    setupRPCServer()
  ]).catch(error => {
    logger.error('Background initialization failed:', error);
  });
});

// Register app event handlers for both modes
app.on('window-all-closed', () => {
  // In MCP mode, keep the app running even when all windows are closed
  // so the MCP server continues to function
  if (process.platform !== 'darwin' && !isMCPMode) {
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
  // Create window when clicking dock icon (both modes)
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle dock icon right-click in MCP mode
app.on('browser-window-created', () => {
  if (isMCPMode && process.platform === 'darwin') {
    // Set dock icon badge to indicate MCP mode
    app.dock?.setBadge('MCP');
  }
});

// Initialize storage on startup
async function initializeStorage() {
  const isMCPMode = process.env.ENABLE_MCP_SERVER === 'true' || process.argv.includes('--mcp');
  
  logger.log('🗄️ Initializing storage...');
  
  // Debug electron-store
  logger.log('🗄️ Electron store path:', store.path);
  logger.log('🗄️ Store contents:', store.store);
  
  // Get the stored directory - don't set default automatically
  let notesDirectory = store.get('notesDirectory') as string | undefined;
  logger.log('🗄️ Retrieved notesDirectory from store:', notesDirectory);
  
  if (!notesDirectory) {
    // First time setup - will trigger folder selection in renderer
    logger.log('🗄️ No directory configured - first time setup required');
    return; // Don't initialize storage yet
  }
  
  await initializeStorageWithDirectory(notesDirectory);
}

// Initialize storage with a specific directory
async function initializeStorageWithDirectory(notesDirectory: string) {
  const isMCPMode = process.env.ENABLE_MCP_SERVER === 'true' || process.argv.includes('--mcp');
  
  logger.log('🗄️ Using notes directory:', notesDirectory);
  
  storage = new NotesStorage(notesDirectory);
  await storage.initialize();
  
  // Set up IPC handlers only if they don't exist yet
  if (!ipcHandlers) {
    ipcHandlers = new IPCHandlers(storage);
  } else {
    // Update existing handlers
    ipcHandlers.updateStorage(storage);
  }
  
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

    // Return the configuration data for UI display
    return {
      configPath,
      mcpConfig,
      appPath,
      isDev
    };
    
  } catch (error) {
    logger.error('Error generating MCP config:', error);
    throw error;
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


// Storage directory handlers (only in normal Electron mode)
if (!isMCPMode) {
  ipcMain.handle('get-storage-config', () => {
    const notesDirectory = store.get('notesDirectory') as string | undefined;
    logger.log('IPC: get-storage-config called, returning:', {
      notesDirectory,
      initialized: !!notesDirectory && !!storage
    });
    return {
      notesDirectory: notesDirectory || null,
      initialized: !!notesDirectory && !!storage
    };
  });


  ipcMain.handle('select-notes-directory', async () => {
    logger.log('Main: select-notes-directory called');
    logger.log('Main: mainWindow exists?', !!mainWindow);
    logger.log('Main: mainWindow focused?', mainWindow?.isFocused());
    logger.log('Main: mainWindow visible?', mainWindow?.isVisible());
    
    try {
      // Check permissions on macOS
      if (process.platform === 'darwin') {
        logger.log('Main: Checking macOS permissions...');
        try {
          // Try to read the documents directory to trigger permission prompt
          const docsPath = app.getPath('documents');
          await fs.access(docsPath);
          const docContents = await fs.readdir(docsPath);
          logger.log('Main: Successfully read documents directory, found', docContents.length, 'items');
        } catch (permError) {
          logger.error('Main: Permissions error:', permError);
        }
      }
      
      // Ensure window is focused before showing dialog
      if (mainWindow && !mainWindow.isFocused()) {
        logger.log('Main: Focusing window before dialog...');
        mainWindow.focus();
        // Small delay to ensure focus is complete
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      logger.log('Main: About to show dialog...');
      logger.log('Main: Current documents path:', app.getPath('documents'));
      
      // Show directory picker dialog - use both openFile and openDirectory for macOS compatibility
      const dialogOptions: Electron.OpenDialogOptions = {
        title: 'Select Notes Directory',
        defaultPath: app.getPath('documents'),
        // Include both openFile and openDirectory to work around macOS Electron bug
        properties: process.platform === 'darwin' ? ['openFile', 'openDirectory'] : ['openDirectory'],
        message: 'Choose a directory for storing your notes'
      };
      
      logger.log('Main: Dialog options:', JSON.stringify(dialogOptions));
      logger.log('Main: Process platform:', process.platform);
      
      let result;
      try {
        logger.log('Main: Showing directory selection dialog...');
        result = await dialog.showOpenDialog(mainWindow!, dialogOptions);
      } catch (dialogError) {
        logger.error('Main: Error showing dialog:', dialogError);
        // Fallback: try without any parent
        result = await dialog.showOpenDialog(dialogOptions);
      }
      
      logger.log('Main: Dialog result:', JSON.stringify(result));
      logger.log('Main: Dialog canceled?', result.canceled);
      logger.log('Main: File paths:', result.filePaths);
      logger.log('Main: File paths length:', result.filePaths?.length);
      
      if (result.canceled) {
        logger.log('Main: User explicitly cancelled the dialog');
        return null;
      }
      
      if (!result.filePaths || result.filePaths.length === 0) {
        logger.log('Main: No paths returned from dialog, trying alternative approach...');
        
        logger.log('Main: No paths returned from dialog - this appears to be a macOS Electron bug');
        logger.log('Main: Trying workaround with mixed file/directory selection...');
        
        // Alternative approach: force both openFile and openDirectory for macOS
        const altDialogOptions: Electron.OpenDialogOptions = {
          title: 'Choose Notes Directory (Select any file in the directory you want)',
          defaultPath: app.getPath('documents'),
          properties: ['openFile', 'openDirectory'],
          message: 'You can select either a directory or any file within the directory you want to use'
        };
        
        logger.log('Main: Trying alternative dialog options:', JSON.stringify(altDialogOptions));
        
        try {
          const altResult = await dialog.showOpenDialog(altDialogOptions);
          logger.log('Main: Alternative dialog result:', JSON.stringify(altResult));
          
          if (!altResult.canceled && altResult.filePaths && altResult.filePaths.length > 0) {
            result = altResult;
          } else {
            logger.log('Main: Alternative dialog also failed, returning null');
            return null;
          }
        } catch (altError) {
          logger.error('Main: Alternative dialog error:', altError);
          return null;
        }
      }
      
      let selectedPath = result.filePaths[0];
      logger.log('Main: Path selected:', selectedPath);
      
      // Check if the selected path is a file or directory
      try {
        const stats = await fs.stat(selectedPath);
        if (stats.isFile()) {
          // If a file was selected, use its parent directory
          selectedPath = path.dirname(selectedPath);
          logger.log('Main: File selected, using parent directory:', selectedPath);
        } else if (stats.isDirectory()) {
          logger.log('Main: Directory selected:', selectedPath);
        } else {
          logger.log('Main: Selected path is neither file nor directory');
          return null;
        }
      } catch (statError) {
        logger.error('Main: Error checking path type:', statError);
        return null;
      }
      
      logger.log('Main: Final directory path:', selectedPath);
      logger.log('Main: Path exists?', await fs.access(selectedPath).then(() => true).catch(() => false));
      
      // Store the selected directory
      logger.log('Main: Storing directory in electron-store...');
      const wasFirstTime = !store.get('notesDirectory');
      
      // Store the directory
      store.set('notesDirectory', selectedPath);
      
      // Force save the store to disk
      store.store = { ...store.store, notesDirectory: selectedPath };
      
      // Verify storage
      const stored = store.get('notesDirectory');
      logger.log('Main: Directory stored and verified:', stored);
      logger.log('Main: Store file path:', store.path);
      
      if (wasFirstTime) {
        logger.log('Main: First time setup - initializing storage...');
        // Initialize storage for the first time
        await initializeStorageWithDirectory(selectedPath);
      } else {
        logger.log('Main: Directory changed - stored but not applying until restart');
        // Directory change will be applied on next app start
        // User will be prompted to restart from the settings UI
      }
      
      logger.log('Main: Returning selected path:', selectedPath);
      return selectedPath;
    } catch (error) {
      logger.error('Main: Dialog error:', error);
      logger.error('Main: Error stack:', error.stack);
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
    const notesDirectory = store.get('notesDirectory') as string | undefined;
    logger.log('IPC: getStorageConfig called, returning:', {
      notesDirectory,
      initialized: !!notesDirectory,
      storageInitialized: !!storage
    });
    return {
      notesDirectory: notesDirectory || null,
      initialized: !!notesDirectory && !!storage,
      backupEnabled: store.get('backup.enabled', false),
      indexingEnabled: store.get('indexing.enabled', true)
    };
  });

  ipcMain.handle('generateMCPConfig', async () => {
    try {
      const configData = await generateMCPConfig();
      return configData;
    } catch (error) {
      logger.error('Failed to generate MCP config:', error);
      throw error;
    }
  });

  ipcMain.handle('restart-app', () => {
    logger.log('🔄 App restart requested');
    app.relaunch();
    app.exit();
  });
}