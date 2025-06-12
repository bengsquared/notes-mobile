'use client'

interface LoadingStateProps {
  message?: string
  className?: string
}

export function LoadingState({ message = "Loading...", className }: LoadingStateProps) {
  return (
    <div className={`h-full flex items-center justify-center ${className || ''}`}>
      <div className="text-muted-foreground">{message}</div>
    </div>
  )
}