# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a notes application built as a monorepo using pnpm workspaces. It consists of a web app for mobile/browser use and an Electron desktop application, both sharing common types and utilities.

## Architecture

### Monorepo Structure
- **@notes-app/shared** - Shared TypeScript types and utilities used by both web and desktop
- **@notes-app/web** - Next.js 15 web application optimized for mobile and browser
- **@notes-app/desktop** - Electron 36 desktop application built with Vite

### Key Technologies
- **Frontend**: React 18/19, TypeScript, Tailwind CSS
- **UI Components**: Radix UI primitives with shadcn/ui component system
- **Forms**: React Hook Form + Zod validation
- **State Management**: localStorage (web), electron-store (desktop)
- **Build Tools**: Next.js (web), Vite + electron-vite (desktop)

## Common Development Commands

### Root Level Commands
```bash
# Install dependencies for all packages
pnpm install

# Run web development server
pnpm dev:web

# Run desktop development
pnpm dev:desktop

# Build all packages in dependency order
pnpm build
```

### Package-Specific Commands

#### Web Package (`packages/web/`)
```bash
pnpm dev      # Start Next.js dev server at localhost:3000
pnpm build    # Build for production
pnpm start    # Run production server
pnpm lint     # Run ESLint
```

#### Desktop Package (`packages/desktop/`)
```bash
pnpm dev      # Run Electron app with hot reload
pnpm build    # Build Electron app
pnpm dist     # Build and package for distribution
```

## Important Architectural Decisions

1. **Component Organization**: UI components are duplicated between web and desktop packages to allow platform-specific optimizations. Desktop components are in `packages/desktop/components/ui/`.

2. **Electron Architecture**: The desktop app uses Vite instead of Next.js, with a main process (`src/main/`) and renderer process (`src/renderer/`) structure.

3. **State Persistence**: 
   - Web: Uses localStorage for note storage
   - Desktop: Uses electron-store for persistent storage

4. **Build Order**: Always build in order: shared → web → desktop (handled automatically by `pnpm build`)

## Key File Locations

- Desktop main process: `packages/desktop/src/main/index.ts`
- Desktop renderer entry: `packages/desktop/src/renderer/`
- Web app entry: `packages/web/app/`
- Shared types: `packages/shared/types/`
- UI components: `packages/{web,desktop}/components/ui/`

## Development Guidelines

- Don't try to run the app. If you need to run it to inspect something, stop and ask the user to run it and provide you with feedback before proceeding.

## Quick Reference

- Whenever looking to build or use a script, check '/Users/ben/Documents/notes-mobile/package.json' to see available scripts