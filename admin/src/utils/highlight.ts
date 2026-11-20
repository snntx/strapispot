import { escapeRegExp, tokenize } from './rank';

export type Segment = { text: string; match: boolean };

/**
 * Cut `text` into pieces, marking the parts that match any word of `query`.
 * Returns plain strings only (no HTML), so it is safe to render as React text.
 */
export function highlightSegments(text: string, query: string): Segment[] {
  const tokens = tokenize(query);
  if (!text || tokens.length === 0) return [{ text, match: false }];

  // Longest words first so "ord" does not hide a longer "order" match.
  const pattern = tokens
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  const re = new RegExp(`(${pattern})`, 'gi');

  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ text: text.slice(last, index), match: false });
    out.push({ text: m[0], match: true });
    last = index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out.length ? out : [{ text, match: false }];
}
