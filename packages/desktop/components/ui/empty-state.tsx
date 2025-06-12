'use client'

import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
  children?: React.ReactNode
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  className,
  children 
}: EmptyStateProps) {
  return (
    <div className={`flex-1 flex items-center justify-center ${className || ''}`}>
      <div className="text-center">
        <Icon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <div className="text-lg font-medium mb-2">{title}</div>
        {description && (
          <div className="text-sm text-muted-foreground mb-4">
            {description}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}