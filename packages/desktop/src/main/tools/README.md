# MCP Tools Refactoring

This directory contains the modularized MCP tool definitions for the Notes application.

## Structure

- **`types.ts`** - Common type definitions
- **`config-tools.ts`** - Configuration and setup tools (3 tools)
- **`note-tools.ts`** - Core note management tools (10 tools)
- **`concept-tools.ts`** - Knowledge graph and concept tools (3 tools)
- **`inbox-tools.ts`** - Idea capture and processing tools (5 tools)
- **`search-tools.ts`** - Search and discovery tools (5 tools)
- **`media-tools.ts`** - Media and attachment tools (4 tools)
- **`index.ts`** - Main export with enhanced error handling

## Benefits

### Better Organization
- Tools are grouped by logical function
- Each module has 3-10 related tools
- Clear separation of concerns

### Enhanced Documentation
- Each tool module includes usage examples
- API examples show real-world usage patterns
- Better discoverability for developers

### Improved Error Messages
- Enhanced error messages with context-aware suggestions
- Tool-specific guidance for common errors
- Parameter validation with helpful hints

### Maintainability
- Easy to add new tools to appropriate categories
- Modular structure supports incremental updates
- Type safety across all tool definitions

## Usage Examples

The modular structure includes comprehensive usage examples:

```typescript
// Configuration tools
await tools.get_storage_config();
await tools.configure_notes_directory({ path: "/Users/username/Documents/notes" });

// Note management
await tools.read_note({ filename: "project-ideas.txt" });
await tools.search_knowledge({ query: "productivity systems", contextDepth: "detailed" });

// Inbox workflow
await tools.capture_idea({ content: "Interesting thought about distributed systems" });
await tools.promote_idea_to_note({ ideaFilename: "idea-123.txt", title: "Distributed Systems" });
```

## Error Handling

Enhanced error messages provide contextual help:

- Missing parameters show exact syntax examples
- Resource not found errors suggest discovery tools
- Configuration errors provide setup guidance
- Tool-specific suggestions based on error patterns

## Total Tools: 33

This modular system manages all 33 MCP tools with improved organization and developer experience.