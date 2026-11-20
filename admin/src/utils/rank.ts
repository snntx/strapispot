/** Split a search string into lower-case words. */
export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * How well does `title` match `query`? Higher is better.
 *   100  exact match
 *    80  title starts with the query
 *    60  a word in the title starts with the query
 *    40  title contains the query
 *    30  title contains every word of the query (in any order)
 *     0  no match in the title
 */
export function scoreTitle(title: string, query: string): number {
  const q = query.trim().toLowerCase();
  const t = title.toLowerCase();
  if (!q || !t) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (new RegExp(`(^|[\\s\\-_/.,:;()"'])${escapeRegExp(q)}`).test(t)) return 60;
  if (t.includes(q)) return 40;
  const tokens = tokenize(q);
  if (tokens.length > 1 && tokens.every((tok) => t.includes(tok))) return 30;
  return 0;
}

/**
 * Final score for a result. A match in the title always beats a match
 * somewhere else; shorter titles win ties (closer to what was typed).
 */
export function scoreResult(title: string, query: string, matchedElsewhere: boolean): number {
  const inTitle = scoreTitle(title, query);
  if (inTitle > 0) return inTitle - Math.min(title.length, 60) / 100;
  return matchedElsewhere ? 10 : 5;
}

/**
 * Find a short piece of text around the first match of any query word, to show
 * why an entry matched when the title does not contain the query.
 */
export function makeSnippet(text: string, query: string, radius = 36): string | null {
  const tokens = tokenize(query);
  const lower = text.toLowerCase();
  let at = -1;
  for (const tok of tokens) {
    const i = lower.indexOf(tok);
    if (i !== -1 && (at === -1 || i < at)) at = i;
  }
  if (at === -1) return null;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + radius * 2);
  const clean = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${clean}${end < text.length ? '…' : ''}`;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
