'use client'

import { useEffect, useRef, forwardRef } from 'react'
import { cn } from '../../lib/utils'
import { useUndoRedo, useAutosave } from '@notes-app/shared'

interface EnhancedTextareaProps extends Omit<React.ComponentProps<'textarea'>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  onSave?: (value: string) => Promise<void>
  autosaveDelay?: number
  enableUndoRedo?: boolean
  enableAutosave?: boolean
  enableKeyboardShortcuts?: boolean
  maxHistorySize?: number
  onUndo?: () => void
  onRedo?: () => void
  onSaveNow?: () => void
}

export const EnhancedTextarea = forwardRef<HTMLTextAreaElement, EnhancedTextareaProps>(
  ({
    value,
    onChange,
    onSave,
    autosaveDelay = 2000,
    enableUndoRedo = true,
    enableAutosave = true,
    enableKeyboardShortcuts = true,
    maxHistorySize = 50,
    onUndo,
    onRedo,
    onSaveNow,
    className,
    ...props
  }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const mergedRef = (ref as React.RefObject<HTMLTextAreaElement>) || textareaRef

    // Undo/redo functionality
    const undoRedo = useUndoRedo(value, maxHistorySize)
    const {
      state: undoRedoValue,
      set: setUndoRedoValue,
      undo,
      redo,
      canUndo,
      canRedo
    } = undoRedo

    // Use undo/redo state if enabled, otherwise use direct value
    const currentValue = enableUndoRedo ? undoRedoValue : value

    // Sync external value changes with undo/redo
    useEffect(() => {
      if (enableUndoRedo && value !== undoRedoValue) {
        setUndoRedoValue(value)
      }
    }, [value, enableUndoRedo, undoRedoValue, setUndoRedoValue])

    // Handle value changes
    const handleChange = (newValue: string) => {
      if (enableUndoRedo) {
        setUndoRedoValue(newValue)
      }
      onChange(newValue)
    }

    // Autosave functionality
    const { saveNow } = enableAutosave && onSave 
      ? useAutosave(currentValue, onSave, autosaveDelay, true)
      : { saveNow: () => Promise.resolve() }

    // Handle external callbacks
    const handleUndo = () => {
      if (enableUndoRedo && canUndo) {
        undo()
        onUndo?.()
      }
    }

    const handleRedo = () => {
      if (enableUndoRedo && canRedo) {
        redo()
        onRedo?.()
      }
    }

    const handleSaveNow = () => {
      saveNow()
      onSaveNow?.()
    }

    // Keyboard shortcuts
    useEffect(() => {
      if (!enableKeyboardShortcuts) return

      const handleKeyDown = (e: KeyboardEvent) => {
        // Only handle if textarea is focused
        if (document.activeElement !== (mergedRef as React.RefObject<HTMLTextAreaElement>).current) return

        if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          handleUndo()
        } else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault()
          handleRedo()
        } else if ((e.metaKey || e.ctrlKey) && e.key === 's') {
          e.preventDefault()
          handleSaveNow()
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [enableKeyboardShortcuts, handleUndo, handleRedo, handleSaveNow])

    return (
      <textarea
        ref={mergedRef as React.RefObject<HTMLTextAreaElement>}
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        value={currentValue}
        onChange={(e) => handleChange(e.target.value)}
        {...props}
      />
    )
  }
)

EnhancedTextarea.displayName = "EnhancedTextarea"