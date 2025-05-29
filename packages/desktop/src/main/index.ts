const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('path');
const { createServer } = require('http');
const Store = require('electron-store');

const store = new Store();
let mainWindow: typeof BrowserWindow.prototype | null = null;
let rpcServer: any = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

function setupRPCServer() {
  createServer((req: any, res: any) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/rpc') {
      let body = '';
      req.on('data', (chunk: any) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          
          // Handle ping method
          if (data.method === 'ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', result: 'pong', id: data.id }));
          } 
          // Handle transferNotes method
          else if (data.method === 'transferNotes' && data.params?.notes) {
            console.log('Received notes:', JSON.stringify(data.params.notes, null, 2));
            mainWindow?.webContents.send('notes-received', data.params.notes);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', result: { success: true }, id: data.id }));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: data.id }));
          }
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  }).listen(8080, () => {
    console.log('RPC server listening on port 8080');
  });
}

app.whenReady().then(() => {
  createWindow();
  setupRPCServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('get-notes-directory', () => {
  const notesDir = store.get('notesDirectory', join(app.getPath('documents'), 'DeepNotes'));
  return notesDir;
});

ipcMain.handle('set-notes-directory', (_event: any, path: string) => {
  store.set('notesDirectory', path);
  return true;
});

const fs = require('fs').promises;
const path = require('path');

async function ensureNotesDirectory() {
  const notesDir = store.get('notesDirectory', join(app.getPath('documents'), 'DeepNotes'));
  await fs.mkdir(notesDir, { recursive: true });
  return notesDir;
}

ipcMain.handle('save-note', async (_event: any, filename: string, content: string) => {
  const notesDir = await ensureNotesDirectory();
  const filePath = join(notesDir, filename);
  await fs.writeFile(filePath, content, 'utf8');
  return true;
});

ipcMain.handle('load-note', async (_event: any, filename: string) => {
  const notesDir = await ensureNotesDirectory();
  const filePath = join(notesDir, filename);
  const content = await fs.readFile(filePath, 'utf8');
  return content;
});

ipcMain.handle('list-notes', async () => {
  const notesDir = await ensureNotesDirectory();
  const files = await fs.readdir(notesDir);
  return files.filter((file: string) => file.endsWith('.txt'));
});

ipcMain.handle('delete-note', async (_event: any, filename: string) => {
  const notesDir = await ensureNotesDirectory();
  const filePath = join(notesDir, filename);
  await fs.unlink(filePath);
  return true;
});