import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Note } from '@notes-app/shared'

export interface UseSearchOptions<T> {
  items: T[]
  searchFields: (keyof T)[]
  filterFn?: (item: T, query: string) => boolean
  debounceMs?: number
}

export function useSearch<T>(options: UseSearchOptions<T>) {
  const { items, searchFields, filterFn, debounceMs = 300 } = options
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [query, debounceMs])

  const filteredItems = useMemo(() => {
    const lowerQuery = debouncedQuery.toLowerCase()

    return items.filter(item => {
      // Use custom filter function if provided
      if (filterFn) {
        return filterFn(item, lowerQuery)
      }

      // If no query, return all items
      if (!debouncedQuery.trim()) return true

      // Default: search in specified fields
      return searchFields.some(field => {
        const value = item[field]
        if (typeof value === 'string') {
          return value.toLowerCase().includes(lowerQuery)
        }
        if (Array.isArray(value)) {
          return value.some(v => 
            typeof v === 'string' && v.toLowerCase().includes(lowerQuery)
          )
        }
        return false
      })
    })
  }, [items, debouncedQuery, searchFields, filterFn])

  const clearSearch = useCallback(() => {
    setQuery('')
  }, [])

  return {
    query,
    setQuery,
    filteredItems,
    clearSearch,
    hasQuery: !!debouncedQuery.trim(),
    isSearching: query !== debouncedQuery
  }
}

// Specialized hooks for common use cases
export function useNoteSearch(notes: Note[], excludeFilename?: string) {
  return useSearch({
    items: notes,
    searchFields: ['filename'] as (keyof Note)[],
    filterFn: (note, query) => {
      if (note.filename === excludeFilename) return false
      
      const title = note.metadata?.title || note.filename.replace('.txt', '')
      const matches = title.toLowerCase().includes(query) || 
                     note.filename.toLowerCase().includes(query)
      
      if (query) {
        console.log(`🔍 Search filter: "${title}" matches "${query}": ${matches}`)
      }
      
      return matches
    }
  })
}

export function useConceptSearch(concepts: string[], excludeConcepts?: string[]) {
  return useSearch({
    items: concepts,
    searchFields: [] as never[], // Using custom filter
    filterFn: (concept, query) => {
      if (excludeConcepts?.includes(concept)) return false
      // If no query, show all non-excluded concepts
      if (!query.trim()) return true
      return concept.toLowerCase().includes(query)
    },
    debounceMs: 0 // No debounce for concepts for faster response
  })
}