import { useEffect, useRef, useCallback } from 'react'

export function useAutosave<T>(
  data: T,
  saveFunction: (data: T) => Promise<void>,
  delay = 2000, // 2 seconds
  enabled = true
) {
  const timeoutRef = useRef<NodeJS.Timeout>()
  const lastSavedRef = useRef<T>(data)
  const isSavingRef = useRef(false)

  const save = useCallback(async (forceData?: T) => {
    const dataToSave = forceData ?? data
    
    if (isSavingRef.current) return
    
    isSavingRef.current = true
    try {
      await saveFunction(dataToSave)
      lastSavedRef.current = dataToSave
    } catch (error) {
      console.error('Autosave failed:', error)
    } finally {
      isSavingRef.current = false
    }
  }, [data, saveFunction])

  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    save()
  }, [save])

  useEffect(() => {
    if (!enabled) return

    // Don't autosave if data hasn't changed
    if (data === lastSavedRef.current) return

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      save()
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, save, delay, enabled])

  // Save on unmount - use ref to get current data
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => {
    return () => {
      if (dataRef.current !== lastSavedRef.current && !isSavingRef.current) {
        save(dataRef.current)
      }
    }
  }, [save]) // Include save in deps since it's used in cleanup

  return { saveNow, isSaving: isSavingRef.current }
}