const { spawn } = require('child_process');
const path = require('path');

// Test the MCP server configuration generation
async function testMCPConfig() {
  console.log('Testing MCP configuration generation...');
  
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
  
  // Request tools list
  setTimeout(() => {
    const toolsMessage = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    };
    child.stdin.write(JSON.stringify(toolsMessage) + '\n');
  }, 100);
  
  // Request config generation
  setTimeout(() => {
    const configMessage = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "generate_mcp_configuration",
        arguments: {}
      }
    };
    child.stdin.write(JSON.stringify(configMessage) + '\n');
  }, 200);
  
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

testMCPConfig().catch(console.error);