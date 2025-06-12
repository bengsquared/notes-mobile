/**
 * Standardized date formatting utilities for the application
 */

export function formatDate(dateString?: string): string {
  if (!dateString) return 'Unknown'
  
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function formatDateTime(dateString?: string): string {
  if (!dateString) return 'Unknown'
  
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function formatTime(dateString?: string): string {
  if (!dateString) return 'Unknown'
  
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Unknown'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return formatDate(dateString)
}

export function isToday(dateString?: string): boolean {
  if (!dateString) return false
  
  const date = new Date(dateString)
  const today = new Date()
  
  return date.toDateString() === today.toDateString()
}

export function isRecent(dateString?: string, hoursThreshold = 24): boolean {
  if (!dateString) return false
  
  const date = new Date(dateString)
  const now = new Date()
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
  
  return diffHours <= hoursThreshold
}