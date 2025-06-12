/**
 * Utility functions for extracting and formatting titles from content
 */

/**
 * Extracts a meaningful title from content
 * Uses the first line if it looks like a title, otherwise first N characters
 */
export function extractTitleFromContent(content: string, maxLength: number = 50): string {
  if (!content?.trim()) return ''
  
  const lines = content.trim().split('\n')
  const firstLine = lines[0]?.trim()
  
  // If first line is short and doesn't end with punctuation, use it as title
  if (firstLine && firstLine.length <= maxLength && !firstLine.match(/[.!?]$/)) {
    return firstLine
  }
  
  // Otherwise, take first N characters and add ellipsis if truncated
  const truncated = content.trim().substring(0, maxLength)
  return truncated.length < content.trim().length ? `${truncated}...` : truncated
}

/**
 * Converts a title to a safe filename
 * Removes special characters and limits length
 */
export function titleToFilename(title: string, maxLength: number = 100): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .substring(0, maxLength)
}

/**
 * Gets display title for an idea
 * Prefers metadata.title, falls back to content preview
 */
export function getDisplayTitle(title: string | undefined, content: string, filename: string): string {
  if (title?.trim()) return title
  
  const contentTitle = extractTitleFromContent(content, 40)
  if (contentTitle) return contentTitle
  
  // Fallback to filename without extension and prefix
  return filename.replace(/^idea-\d+-/, '').replace(/\.txt$/, '') || 'Untitled'
}