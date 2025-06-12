const { spawn } = require('child_process');
const path = require('path');

// Test configuring notes directory via MCP
async function testConfigureNotes() {
  console.log('Testing notes directory configuration...');
  
  const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron');
  const mainPath = path.join(__dirname, 'packages', 'desktop', 'out', 'main', 'index.js');
  
  const child = spawn(electronPath, [mainPath, '--mcp'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Send initialize message
  const initMessage = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" }
    }
  };
  
  child.stdin.write(JSON.stringify(initMessage) + '\n');
  
  // Configure notes directory
  setTimeout(() => {
    const configMessage = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "configure_notes_directory",
        arguments: {
          path: "/Users/ben/Documents/notes-mobile/test-notes"
        }
      }
    };
    child.stdin.write(JSON.stringify(configMessage) + '\n');
  }, 200);
  
  // Get storage config to verify
  setTimeout(() => {
    const statusMessage = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "get_storage_config",
        arguments: {}
      }
    };
    child.stdin.write(JSON.stringify(statusMessage) + '\n');
  }, 400);
  
  child.stdout.on('data', (data) => {
    console.log('STDOUT:', data.toString());
  });
  
  child.stderr.on('data', (data) => {
    console.log('STDERR:', data.toString());
  });
  
  setTimeout(() => {
    child.kill();
    console.log('Test completed');
  }, 2000);
}

testConfigureNotes().catch(console.error);