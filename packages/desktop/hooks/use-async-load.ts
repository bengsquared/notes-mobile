import { useState, useEffect, useCallback, useRef } from 'react'

export interface UseAsyncLoadOptions<T> {
  loadFn: () => Promise<T>
  deps?: React.DependencyList
  initialValue?: T
}

export function useAsyncLoad<T>({ loadFn, deps = [], initialValue }: UseAsyncLoadOptions<T>) {
  const [data, setData] = useState<T | undefined>(initialValue)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    setLoading(true)
    setError(null)

    try {
      const result = await loadFn()
      
      // Check if the request was cancelled
      if (abortController.signal.aborted) return
      
      setData(result)
    } catch (err) {
      // Don't set error if request was cancelled
      if (!abortController.signal.aborted) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        console.error('useAsyncLoad error:', err)
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false)
      }
    }
  }, [loadFn])

  useEffect(() => {
    load()
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, deps)

  const retry = useCallback(() => {
    load()
  }, [load])

  return {
    data,
    loading,
    error,
    retry,
    reload: load
  }
}