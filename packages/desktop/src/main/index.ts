import { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage } from 'electron';
import path from 'path';
import Store from 'electron-store';
import { promises as fs } from 'fs';
import { NotesStorage } from '../lib/storage';
import { IPCHandlers } from './ipc-handlers';
import { NotesMCPServer } from './mcp-server';
import { HTTPSignalingServer } from './http-signaling-server';
import os from 'os';

const { join } = path;

// Helper functions for icon paths
function getAppIcon(): string {
  const resourcesPath = app.isPackaged ? process.resourcesPath : join(__dirname, '../../');

  if (process.platform === 'darwin') {
    return join(resourcesPath, 'resources/icon.icns');
  } else if (process.platform === 'win32') {
    // Use .ico file for Windows
    return join(resourcesPath, 'resources/icon.ico');
  } else {
    return join(resourcesPath, 'resources/logo.png');
  }
}

function getTrayIcon(): Electron.NativeImage {
  if (process.platform === 'darwin') {
    // Use template icon for macOS tray (allows for proper dark/light mode handling)
    const templatePath = app.isPackaged
      ? join(process.resourcesPath, 'resources/template@2x.png')
      : join(__dirname, '../../resources/template@2x.png');
    return nativeImage.createFromPath(templatePath);
  } else {
    // Use regular icon for other platforms
    const iconPath = app.isPackaged
      ? join(process.resourcesPath, 'resources/logo.png')
      : join(__dirname, '../../resources/logo.png');
    return nativeImage.createFromPath(iconPath);
  }
}

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
let tray: Tray | null = null;
let currentPIN: string | null = null;
let pinExpiryTimeout: NodeJS.Timeout | null = null;
let storage: NotesStorage | null = null;
let ipcHandlers: IPCHandlers | null = null;
let mcpServer: NotesMCPServer | null = null;
let httpSignalingServer: HTTPSignalingServer | null = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: getAppIcon(),
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
    logger.log('🔧 Development mode detected - loading from Vite dev server');
    // Development mode - use Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    
    // Force open dev tools in development
    mainWindow.webContents.once('did-finish-load', () => {
      logger.log('🔧 Opening dev tools in development mode');
      mainWindow?.webContents.openDevTools();
    });
    
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
    // mainWindow.webContents.on('devtools-opened', () => {
    //   if (isPackaged && mainWindow) {
    //     mainWindow.webContents.closeDevTools();
    //   }
    // });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Stop HTTP signaling server when window closes
    if (httpSignalingServer) {
      httpSignalingServer.stop();
      httpSignalingServer = null;
    }
  });

  // Start HTTP signaling server for P2P transfers
  if (!httpSignalingServer) {
    httpSignalingServer = new HTTPSignalingServer(mainWindow);
    try {
      await httpSignalingServer.start();
      logger.log('📡 HTTP Signaling Server started for P2P transfers');
    } catch (error) {
      logger.error('📡 Failed to start HTTP Signaling Server:', error);
    }
  }
}

function createTray() {
  const trayIcon = getTrayIcon();
  tray = new Tray(trayIcon);

  // Set tooltip
  tray.setToolTip('Notes App');

  // Create context menu for tray
  const contextMenu = Menu.buildFromTemplate([
    ...(isMCPMode ? [
      {
        label: 'MCP Server Running',
        enabled: false
      },
      {
        label: 'Claude integration active',
        enabled: false
      },
      { type: 'separator' as const },
      {
        label: 'Open Full App',
        click: () => {
          // Launch a new instance without MCP mode
          const { spawn } = require('child_process');
          const appPath = process.execPath;
          spawn(appPath, [], { detached: true, stdio: 'ignore' }).unref();
        }
      }
    ] : [
      {
        label: 'Show App',
        click: () => {
          if (mainWindow === null) {
            createWindow();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'New Window',
        click: () => {
          createWindow();
        }
      },
      { type: 'separator' as const },
      {
        label: 'Notes App',
        enabled: false
      }
    ]),
    { type: 'separator' as const },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // Handle tray icon click
  // tray.on('click', () => {
  //   if (mainWindow === null) {
  //     createWindow();
  //   } else if (mainWindow.isVisible()) {
  //     mainWindow.hide();
  //   } else {
  //     mainWindow.show();
  //     mainWindow.focus();
  //   }
  // });
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
            if (!isMCPMode) {
              createWindow();
            }
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

// Get local IP addresses for QR code generation
function getLocalIPAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  
  for (const interfaceName of Object.keys(interfaces)) {
    const nets = interfaces[interfaceName] || [];
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  
  return addresses;
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

// PIN validation is now handled in the frontend

// WebRTC is now handled entirely in the frontend - no main process setup needed

// WebRTC signaling is now handled entirely in the frontend - no server needed

// Notes are now handled entirely in the frontend via standard Electron APIs

// Always run full Electron app, but skip initial window creation in MCP mode
app.whenReady().then(async () => {
  // Register essential IPC handlers first
  registerTransferHandlers();

  // Set up application menu
  setupApplicationMenu();

  // Create tray icon for all modes
  createTray();

  // Create window immediately for faster startup (unless in MCP mode)
  if (!isMCPMode) {
    createWindow();
  } else {
    logger.log('🔧 MCP mode: App started without window. Use File > New Window or click dock icon to open interface.');
    // app.dock?.hide(); // Hide dock icon in MCP mode - commented out for now
    // In MCP mode, we don't create a window immediately
    // Set dock icon badge to indicate MCP mode
    if (process.platform === 'darwin') {
      app.dock?.setBadge('MCP');
    }
  }

  // Initialize storage in background
  if (!isMCPMode) {
    initializeStorage().catch(error => {
      logger.error('Background initialization failed:', error);
    });
  } else {
    // In MCP mode, just initialize the MCP server
    initializeStorage();
  }
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
  if (tray) {
    tray.destroy();
    tray = null;
  }

  // mDNS cleanup is no longer needed

  // WebRTC is now handled entirely in the frontend - no cleanup needed

  if (pinExpiryTimeout) {
    clearTimeout(pinExpiryTimeout);
    pinExpiryTimeout = null;
  }
});

app.on('activate', () => {
  // Create window when clicking dock icon (only in normal mode)
  if (mainWindow === null && !isMCPMode) {
    createWindow();
  }
  // In MCP mode, just show the dock icon badge
  if (isMCPMode && process.platform === 'darwin') {
    app.dock?.setBadge('MCP');
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
  const isMCPMode = process.env.ENABLE_MCP_SERVER === 'true' || process.argv.includes('--mcp');
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

      let result: Electron.OpenDialogReturnValue;
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
    
    // Get local IP addresses for QR code generation
    const localIPs = getLocalIPAddresses();
    const primaryIP = localIPs[0] || 'localhost';
    logger.log('📡 IPC: Local IPs found:', localIPs, 'using primary:', primaryIP);
    
    logger.log('📡 IPC: Sending transfer-pin-generated event to renderer');
    logger.log('📡 IPC: mainWindow exists:', !!mainWindow);
    logger.log('📡 IPC: webContents exists:', !!mainWindow?.webContents);
    mainWindow?.webContents.send('transfer-pin-generated', { pin, ip: primaryIP, port: 8080 });
    logger.log('🔄 IPC: Event sent, returning PIN to renderer');
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

  // HTTP Signaling Server handlers
  ipcMain.handle('submit-webrtc-answer', (_event, pin: string, answer: string) => {
    logger.log(`🎯 IPC: submit-webrtc-answer called for PIN ${pin}`);
    if (httpSignalingServer) {
      const success = httpSignalingServer.submitAnswer(pin, answer);
      logger.log(`📡 IPC: Answer submitted - success: ${success}`);
      return success;
    }
    return false;
  });

  ipcMain.handle('get-pending-offer', (_event, pin: string) => {
    logger.log(`🎯 IPC: get-pending-offer called for PIN ${pin}`);
    if (httpSignalingServer) {
      const offer = httpSignalingServer.getPendingOffer(pin);
      logger.log(`📡 IPC: Retrieved offer for PIN ${pin} - ${offer ? 'found' : 'not found'}`);
      return offer;
    }
    return null;
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