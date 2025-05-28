const { app, BrowserWindow, ipcMain } = require('electron');
const { join } = require('path');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const Store = require('electron-store');

const store = new Store();
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev, dir: join(__dirname, '../../') });
const handle = nextApp.getRequestHandler();

let mainWindow: BrowserWindow | null = null;
let rpcServer: any = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js')
    }
  });

  await nextApp.prepare();
  
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  server.listen(3001, () => {
    console.log('> Ready on http://localhost:3001');
    mainWindow?.loadURL('http://localhost:3001');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupRPCServer() {
  createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/rpc') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.method === 'transferNotes' && data.params?.notes) {
            mainWindow?.webContents.send('notes-received', data.params.notes);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
          } else {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Invalid request' }));
          }
        } catch (error) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Server error' }));
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

ipcMain.handle('set-notes-directory', (event, path) => {
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

ipcMain.handle('save-note', async (event, filename, content) => {
  const notesDir = await ensureNotesDirectory();
  const filePath = join(notesDir, filename);
  await fs.writeFile(filePath, content, 'utf8');
  return true;
});

ipcMain.handle('load-note', async (event, filename) => {
  const notesDir = await ensureNotesDirectory();
  const filePath = join(notesDir, filename);
  const content = await fs.readFile(filePath, 'utf8');
  return content;
});

ipcMain.handle('list-notes', async () => {
  const notesDir = await ensureNotesDirectory();
  const files = await fs.readdir(notesDir);
  return files.filter(file => file.endsWith('.txt'));
});

ipcMain.handle('delete-note', async (event, filename) => {
  const notesDir = await ensureNotesDirectory();
  const filePath = join(notesDir, filename);
  await fs.unlink(filePath);
  return true;
});