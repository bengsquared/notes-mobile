import { useState, useCallback } from 'react'

export interface ErrorState {
  message: string | null
  isValidating: boolean
}

export function useErrorHandler() {
  const [error, setError] = useState<ErrorState>({
    message: null,
    isValidating: false
  })

  const handleError = useCallback((error: unknown, userMessage?: string) => {
    console.error('Component error:', error)
    const message = userMessage || 
      (error instanceof Error ? error.message : 'An unexpected error occurred')
    
    setError({
      message,
      isValidating: false
    })
  }, [])

  const setValidating = useCallback((validating: boolean) => {
    setError(prev => ({
      ...prev,
      isValidating: validating
    }))
  }, [])

  const clearError = useCallback(() => {
    setError({
      message: null,
      isValidating: false
    })
  }, [])

  const setErrorMessage = useCallback((message: string | null) => {
    setError(prev => ({
      ...prev,
      message
    }))
  }, [])

  return { 
    error, 
    handleError, 
    setValidating, 
    clearError, 
    setErrorMessage,
    hasError: !!error.message
  }
}