type ChromeTabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan';

const CHROME_COLORS: { name: ChromeTabGroupColor; rgb: [number, number, number] }[] = [
  { name: 'grey',   rgb: [128, 128, 128] },
  { name: 'blue',   rgb: [66, 133, 244] },
  { name: 'red',    rgb: [234, 67, 53] },
  { name: 'yellow', rgb: [251, 188, 4] },
  { name: 'green',  rgb: [52, 168, 83] },
  { name: 'pink',   rgb: [255, 105, 180] },
  { name: 'purple', rgb: [103, 58, 183] },
  { name: 'cyan',   rgb: [0, 188, 212] },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const match = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!match) return null;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

export function hexToChromeColor(hex: string | null | undefined): ChromeTabGroupColor {
  if (!hex) return 'grey';
  const rgb = hexToRgb(hex);
  if (!rgb) return 'grey';

  let closest: ChromeTabGroupColor = 'grey';
  let minDist = Infinity;
  for (const entry of CHROME_COLORS) {
    const dist = colorDistance(rgb, entry.rgb);
    if (dist < minDist) {
      minDist = dist;
      closest = entry.name;
    }
  }
  return closest;
}

export function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    const normalized = normalizeTabGroupUrl(url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(url);
    }
  }
  return unique;
}

function normalizeTabGroupUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch {
    return url;
  }
}
