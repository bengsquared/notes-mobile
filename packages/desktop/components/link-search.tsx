'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Plus } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import type { Note } from '../../../shared/src/types'

export interface SearchItem {
  id: string
  title: string
  subtitle?: string
  icon?: React.ReactNode
}

interface LinkSearchProps {
  title: string
  placeholder: string
  searchQuery: string
  onSearchChange: (query: string) => void
  isOpen: boolean
  onToggle: () => void
  items: SearchItem[]
  onItemSelect: (item: SearchItem) => void
  maxItems?: number
  emptyMessage?: string
}

export function LinkSearch({
  title,
  placeholder,
  searchQuery,
  onSearchChange,
  isOpen,
  onToggle,
  items,
  onItemSelect,
  maxItems = 10,
  emptyMessage = "No results found"
}: LinkSearchProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Handle clicks outside to close search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false)
        setIsFocused(false)
        if (isOpen) {
          onToggle()
          onSearchChange('')
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onToggle, onSearchChange])

  // Show results when focused and has items or when searching
  useEffect(() => {
    const shouldShow = isOpen && (isFocused || searchQuery.length >= 0) // Changed to >= 0 to always show when focused
    console.log('🔍 LinkSearch dropdown visibility:', {
      isOpen,
      isFocused,
      searchQuery,
      shouldShow,
      itemsCount: items.length
    })
    setShowResults(shouldShow)
    if (shouldShow) {
      updateDropdownPosition()
    }
  }, [isOpen, isFocused, searchQuery, items.length])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onToggle()
      onSearchChange('')
      setShowResults(false)
      inputRef.current?.blur()
    }
  }

  const updateDropdownPosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const position = {
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      }
      console.log('🔍 Dropdown position:', position)
      setDropdownPosition(position)
    }
  }

  const handleFocus = () => {
    setIsFocused(true)
    updateDropdownPosition()
  }

  const handleBlur = () => {
    // Delay blur to allow click events on dropdown items to fire first
    setTimeout(() => {
      setIsFocused(false)
    }, 200)
  }

  const clearSearch = () => {
    onSearchChange('')
    setShowResults(false)
  }

  // Create dropdown content
  const dropdownContent = showResults && (
    <div 
      className="fixed mt-1 max-h-40 overflow-y-auto border-2 border-border rounded-lg shadow-2xl bg-white dark:bg-gray-900"
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        width: dropdownPosition.width,
        zIndex: 10000
      }}
    >
      {items.length > 0 ? (
        items.slice(0, maxItems).map((item, index) => (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sm h-auto py-2 px-3 rounded-none border-b border-border/50 last:border-b-0 hover:bg-accent transition-colors duration-150"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('🔍 LinkSearch item clicked:', item.id, item.title)
              onItemSelect(item)
              setShowResults(false)
              onToggle()
              onSearchChange('')
            }}
          >
            <div className="flex items-center w-full gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                <Plus className="h-3 w-3 text-primary" />
              </div>
              {item.icon && <span className="flex-shrink-0">{item.icon}</span>}
              <div className="flex flex-col items-start flex-1 min-w-0">
                <div className="truncate w-full text-sm font-medium">{item.title}</div>
                {item.subtitle && (
                  <div className="text-xs text-muted-foreground truncate w-full">
                    {item.subtitle}
                  </div>
                )}
              </div>
            </div>
          </Button>
        ))
      ) : (
        <div className="p-3 text-sm text-muted-foreground text-center">
          {searchQuery ? emptyMessage : 'No items available'}
        </div>
      )}
    </div>
  )

  if (!isOpen) {
    // Small, unobtrusive add button
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggle}
        className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-150 justify-start"
      >
        <Plus className="h-3 w-3 mr-2" />
        {title.replace('Search & Attach ', '').replace('Add ', '')}
      </Button>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Inline search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className="pl-10 pr-10 text-sm h-8 border-input transition-all duration-200 focus:border-primary focus:ring-1 focus:ring-primary"
          autoFocus
        />
        <Button
          size="xs"
          variant="ghost"
          className="absolute right-2 top-1/2 -translate-y-1/2 hover:bg-muted"
          onClick={() => {
            onToggle()
            onSearchChange('')
          }}
          aria-label="Cancel"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      
      {/* Dropdown content using portal to escape stacking context */}
      {showResults && typeof document !== 'undefined' && createPortal(
        dropdownContent,
        document.body
      )}
    </div>
  )
}

// Helper functions to convert data to SearchItem format
export const notesToSearchItems = (notes: Note[], excludeFilename?: string): SearchItem[] => {
  return notes
    .filter(note => note.filename !== excludeFilename)
    .map(note => ({
      id: note.filename,
      title: note.metadata.title || note.filename.replace('.txt', ''),
      subtitle: note.metadata.title ? note.filename : undefined
    }))
}

export const conceptsToSearchItems = (concepts: string[], excludeConcepts?: string[]): SearchItem[] => {
  return concepts
    .filter(concept => !excludeConcepts?.includes(concept))
    .map(concept => ({
      id: concept,
      title: concept,
      icon: <span className="text-muted-foreground">#</span>
    }))
}