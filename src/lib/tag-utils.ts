import { TAG_COLORS } from './types';

/** Extract hashtag names from note content. Returns lowercase unique names.
 *  Pattern: # followed by 1-50 word chars, preceded by whitespace or start of line.
 *  IMPORTANT: Regex is created inside the function (not module-level) because /g flag
 *  maintains lastIndex state between calls, which would cause bugs if reused. */
export function extractHashtags(content: string): string[] {
  const regex = /(?:^|(?<=\s))#([a-zA-Z0-9_-]{1,50})(?=\s|$)/g;
  const tags = new Set<string>();
  let match;
  while ((match = regex.exec(content)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags);
}

/** Assign a random color from the palette. */
export function assignRandomColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
}

/** Get the next sibling order value for a folder list. */
export function getNextOrder(siblings: { order: number }[]): number {
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map(s => s.order)) + 1;
}
