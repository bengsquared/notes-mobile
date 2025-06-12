'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

export type FeedbackType = 'loading' | 'success' | 'error' | null

interface ActionFeedbackProps {
  type: FeedbackType
  message?: string
  className?: string
  duration?: number
  onComplete?: () => void
}

export function ActionFeedback({ 
  type, 
  message, 
  className, 
  duration = 2000,
  onComplete 
}: ActionFeedbackProps) {
  useEffect(() => {
    if (type === 'success' || type === 'error') {
      const timer = setTimeout(() => {
        onComplete?.()
      }, duration)
      
      return () => clearTimeout(timer)
    }
  }, [type, duration, onComplete])

  if (!type) return null

  const getIcon = () => {
    switch (type) {
      case 'loading':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'success':
        return <Check className="h-4 w-4" />
      case 'error':
        return <AlertCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  const getColor = () => {
    switch (type) {
      case 'loading':
        return 'text-primary'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-destructive'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <div className={cn(
      'flex items-center gap-2 text-sm transition-all duration-200',
      getColor(),
      className
    )}>
      {getIcon()}
      {message && <span>{message}</span>}
    </div>
  )
}

export function useActionFeedback() {
  const [feedback, setFeedback] = useState<{
    type: FeedbackType
    message?: string
  }>({ type: null })

  const showLoading = (message?: string) => {
    setFeedback({ type: 'loading', message })
  }

  const showSuccess = (message?: string) => {
    setFeedback({ type: 'success', message })
  }

  const showError = (message?: string) => {
    setFeedback({ type: 'error', message })
  }

  const clear = () => {
    setFeedback({ type: null })
  }

  return {
    feedback: feedback.type,
    message: feedback.message,
    showLoading,
    showSuccess,
    showError,
    clear
  }
}