import { useState, useCallback, useRef } from 'react'

interface UndoRedoState<T> {
  past: T[]
  present: T
  future: T[]
}

export function useUndoRedo<T>(initialState: T, maxHistorySize = 50) {
  const [state, setState] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: []
  })

  const canUndo = state.past.length > 0
  const canRedo = state.future.length > 0

  const undo = useCallback(() => {
    if (!canUndo) return

    setState(currentState => {
      const previous = currentState.past[currentState.past.length - 1]
      const newPast = currentState.past.slice(0, currentState.past.length - 1)

      return {
        past: newPast,
        present: previous,
        future: [currentState.present, ...currentState.future]
      }
    })
  }, [canUndo])

  const redo = useCallback(() => {
    if (!canRedo) return

    setState(currentState => {
      const next = currentState.future[0]
      const newFuture = currentState.future.slice(1)

      return {
        past: [...currentState.past, currentState.present],
        present: next,
        future: newFuture
      }
    })
  }, [canRedo])

  const set = useCallback((newPresent: T | ((current: T) => T)) => {
    setState(currentState => {
      const actualNewPresent = typeof newPresent === 'function' 
        ? (newPresent as (current: T) => T)(currentState.present)
        : newPresent

      // Don't add to history if the value hasn't actually changed
      if (actualNewPresent === currentState.present) {
        return currentState
      }

      return {
        past: [...currentState.past, currentState.present].slice(-maxHistorySize),
        present: actualNewPresent,
        future: []
      }
    })
  }, [maxHistorySize])

  const reset = useCallback((newState: T) => {
    setState({
      past: [],
      present: newState,
      future: []
    })
  }, [])

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset
  }
}