const fs = require('fs').promises;
const path = require('path');

// Simple test for MCP server functionality
async function testMCPServer() {
  console.log('Testing MCP server...');
  
  // Test our notes directory structure
  const testDir = '/Users/ben/Documents/notes-mobile/test-notes';
  
  try {
    const inboxFiles = await fs.readdir(path.join(testDir, 'inbox'));
    console.log('Inbox files:', inboxFiles);
    
    const noteFiles = await fs.readdir(testDir);
    const txtFiles = noteFiles.filter(f => f.endsWith('.txt'));
    console.log('Note files:', txtFiles);
    
    const conceptFiles = await fs.readdir(path.join(testDir, 'concepts'));
    console.log('Concept files:', conceptFiles);
    
    console.log('✅ MCP server test data looks good!');
    
    // Test reading a note
    const noteContent = await fs.readFile(path.join(testDir, 'productivity-systems.txt'), 'utf8');
    console.log('\n📄 Sample note content:');
    console.log(noteContent.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMCPServer();