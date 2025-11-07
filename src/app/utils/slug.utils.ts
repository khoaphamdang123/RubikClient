/**
 * Utility functions for converting strings to URL-friendly slugs
 */

/**
 * Converts a string to a URL-friendly slug
 * @param text - The text to convert to a slug
 * @returns A URL-friendly slug
 * 
 * @example
 * toSlug("Rubik's Coach Cube") // returns "rubiks-coach-cube"
 * toSlug("3x3 Speed Cube") // returns "3x3-speed-cube"
 */
export function toSlug(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

/**
 * Converts a slug back to a readable format
 * @param slug - The slug to convert
 * @returns A readable string
 * 
 * @example
 * fromSlug("rubiks-coach-cube") // returns "Rubiks Coach Cube"
 */
export function fromSlug(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generates a unique slug by appending an ID if needed
 * @param text - The text to convert
 * @param id - Optional ID to append for uniqueness
 * @returns A unique slug
 */
export function toUniqueSlug(text: string, id?: number | string): string {
  const baseSlug = toSlug(text);
  return id ? `${baseSlug}-${id}` : baseSlug;
}


