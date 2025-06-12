'use client'

import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from './alert'

interface ErrorAlertProps {
  message: string | null
  className?: string
}

export function ErrorAlert({ message, className }: ErrorAlertProps) {
  if (!message) return null

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}