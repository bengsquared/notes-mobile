export function titleToFilename(title: string): string {
  if (!title.trim()) {
    return '';
  }
  
  // Convert title to filename-safe format
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and dashes
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Replace multiple dashes with single dash
    .replace(/^-|-$/g, '') // Remove leading/trailing dashes
    + '.txt';
}

export function filenameToTitle(filename: string): string {
  return filename
    .replace(/\.txt$/, '') // Remove .txt extension
    .replace(/-/g, ' ') // Replace dashes with spaces
    .replace(/\b\w/g, l => l.toUpperCase()); // Title case
}