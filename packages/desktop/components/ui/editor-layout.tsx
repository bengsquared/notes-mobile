'use client'

import { ArrowLeft, Undo, Redo, Pin, PinOff, Save } from 'lucide-react'
import { Button } from './button'
import { LoadingState } from './loading-state'
import { ErrorAlert } from './error-alert'
import { formatTime } from '../../utils/date'

export interface EditorAction {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'ghost' | 'outline'
}

export interface EditorLayoutProps {
  title: string
  loading?: boolean
  error?: string | null
  children: React.ReactNode
  
  // Navigation
  onBack: () => void
  backLabel?: string
  
  // Save state
  lastSaved?: Date | null
  isSaving?: boolean
  
  // Undo/Redo
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  
  // Pin state
  isPinned?: boolean
  onTogglePin?: () => void
  
  // Custom actions
  actions?: EditorAction[]
  
  // Footer content
  footerInfo?: React.ReactNode
  
  className?: string
}

export function EditorLayout({
  title,
  loading = false,
  error,
  children,
  onBack,
  backLabel = "Back",
  lastSaved,
  isSaving = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  isPinned,
  onTogglePin,
  actions = [],
  footerInfo,
  className = ''
}: EditorLayoutProps) {
  
  if (loading) {
    return <LoadingState message={`Loading ${title.toLowerCase()}...`} />
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {backLabel}
          </Button>
          <div className="ml-4">
            <h1 className="text-xl font-bold">{title}</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Pin button */}
          {onTogglePin && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onTogglePin}
              aria-label={isPinned ? `Unpin ${title.toLowerCase()}` : `Pin ${title.toLowerCase()}`}
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
          )}

          {/* Undo/Redo buttons */}
          {onUndo && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo"
            >
              <Undo className="h-4 w-4" />
            </Button>
          )}
          {onRedo && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo"
            >
              <Redo className="h-4 w-4" />
            </Button>
          )}
          
          {/* Custom actions */}
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'ghost'}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              aria-label={action.label}
            >
              <action.icon className="h-4 w-4" />
            </Button>
          ))}
          
          {/* Save status */}
          <div className="text-sm text-muted-foreground ml-2">
            {isSaving ? (
              <span className="flex items-center gap-1">
                <Save className="h-3 w-3 animate-pulse" />
                Saving...
              </span>
            ) : lastSaved ? (
              <span>Saved {formatTime(lastSaved.toISOString())}</span>
            ) : (
              <span>Autosave enabled</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        {/* Error Alert */}
        <ErrorAlert message={error} className="m-4 mb-0" />
        
        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
        
        {/* Footer */}
        {footerInfo && (
          <div className="border-t p-4">
            {footerInfo}
          </div>
        )}
      </div>
    </div>
  )
}