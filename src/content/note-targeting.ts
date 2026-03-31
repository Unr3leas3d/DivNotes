/**
 * Pure content-targeting helpers for resilient note-to-element resolution.
 * Runs in the content script context (no React, no shared lib imports).
 */

export interface StoredNoteLike {
  url: string;
  elementSelector: string;
  elementTag: string;
  elementXPath?: string;
  elementTextHash?: string;
  elementPosition?: string;
}

// Query params that are tracking noise and should be stripped for URL comparison
const NOISE_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'utm_id',
  'utm_cid',
  'fbclid',
  'gclid',
  'ref',
]);

/**
 * Normalize a URL for comparison: strip hash, trailing slashes, and tracking query params.
 * Returns null for invalid URLs.
 */
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = '';

    // Remove tracking/noise params
    const keysToDelete: string[] = [];
    u.searchParams.forEach((_value, key) => {
      if (NOISE_PARAMS.has(key.toLowerCase())) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      u.searchParams.delete(key);
    }

    // Sort remaining params for stable comparison
    u.searchParams.sort();

    // Strip trailing slash from pathname (but keep root '/')
    if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }

    // Remove empty search string
    let href = u.href;
    if (href.endsWith('?')) {
      href = href.slice(0, -1);
    }
    return href;
  } catch {
    return null;
  }
}

/**
 * Compare two URLs, ignoring trailing slashes, hash fragments, and tracking query params.
 */
export function urlsMatchNoteTarget(currentUrl: string, targetUrl: string): boolean {
  const current = normalizeUrl(currentUrl);
  const target = normalizeUrl(targetUrl);
  return Boolean(current && target && current === target);
}

/**
 * Find a matching DOM element using a fallback chain:
 * 1. CSS Selector
 * 2. XPath
 * 3. Text hash (matching tag + text content)
 * 4. Structural position (index path from body)
 *
 * Returns the first match found, or null.
 */
export function findMatchingElement(
  doc: Document,
  note: StoredNoteLike
): Element | null {
  // 1. CSS Selector
  if (note.elementSelector) {
    try {
      const el = doc.querySelector(note.elementSelector);
      if (el) return el;
    } catch {
      // Invalid selector — fall through
    }
  }

  // 2. XPath
  if (note.elementXPath) {
    try {
      const result = doc.evaluate(
        note.elementXPath,
        doc,
        null,
        9 /* XPathResult.FIRST_ORDERED_NODE_TYPE */,
        null
      );
      if (result.singleNodeValue) {
        return result.singleNodeValue as Element;
      }
    } catch {
      // Invalid XPath — fall through
    }
  }

  // 3. Text hash — find elements with matching tag that contain the text
  if (note.elementTextHash && note.elementTag) {
    try {
      const candidates = doc.getElementsByTagName(note.elementTag);
      for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        if (el.textContent && el.textContent.includes(note.elementTextHash)) {
          return el;
        }
      }
    } catch {
      // Fall through
    }
  }

  // 4. Structural position — comma-separated index path from body
  if (note.elementPosition) {
    try {
      const indices = note.elementPosition.split(',').map(Number);
      let current: Element | null = null;

      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        const parent = i === 0 ? doc.body : current;
        if (!parent || !parent.children || idx >= parent.children.length) {
          current = null;
          break;
        }
        current = parent.children[idx] as Element;
      }

      if (current) return current;
    } catch {
      // Fall through
    }
  }

  return null;
}
