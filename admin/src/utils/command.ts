/**
 * Reads what the user typed into the palette and says what it means.
 *
 * Commands are plain keywords; a leading "/" is optional and means
 * "I am typing a command", so no ordinary search results are shown for it.
 *
 *   "alice"             → ordinary search
 *   "in"                → the "in" command is offered, with all collections
 *   "in ord"            → collection name still being typed (suggestions + ordinary results)
 *   "in order alice"    → search only inside Order for "alice"
 *   "new ord"           → collections you can create in, matching "ord"
 *   "/i"                → commands starting with "i"
 */
export type Command = {
  id: 'in' | 'new';
  keyword: string;
  description: string;
};

export const COMMANDS: Command[] = [
  { id: 'in', keyword: 'in', description: 'Search inside one collection' },
  { id: 'new', keyword: 'new', description: 'Create a new entry' },
];

export type InArgs = {
  /** The collection name typed so far (may be empty or partial). */
  token: string;
  /** True once a space follows the collection name. */
  tokenDone: boolean;
  /** What to search for inside that collection. */
  text: string;
};

export type ParsedInput = {
  /** The user started with "/". */
  slash: boolean;
  /** Text for an ordinary search across everything. Empty for "/…" input. */
  plain: string;
  /** The command whose keyword was typed in full, if any. */
  invoked: Command | null;
  /** Commands to offer while a "/command" is being typed. */
  suggested: Command[];
  inArgs: InArgs | null;
  /** What follows "new": the collection name typed so far (may be empty or several words). */
  newToken: string | null;
  /** A "/word" that matches no command. */
  unknown: string | null;
};

export function parseInput(raw: string): ParsedInput {
  const slash = raw.startsWith('/');
  const body = slash ? raw.slice(1) : raw;
  const m = /^(\S*)(\s+([\s\S]*))?$/.exec(body);
  const word = (m?.[1] ?? '').toLowerCase();
  const hasSpace = m?.[2] !== undefined;
  const args = m?.[3] ?? '';

  const invoked = word ? (COMMANDS.find((c) => c.keyword === word) ?? null) : null;
  const suggested =
    !invoked && slash && !hasSpace ? COMMANDS.filter((c) => c.keyword.startsWith(word)) : [];
  const unknown = slash && !invoked && suggested.length === 0 ? word || '/' : null;

  let inArgs: InArgs | null = null;
  if (invoked?.id === 'in') {
    const parts = /^(\S+)(\s+)?([\s\S]*)$/.exec(args);
    inArgs = parts
      ? { token: parts[1], tokenDone: parts[2] !== undefined, text: parts[3].trim() }
      : { token: '', tokenDone: false, text: '' };
  }

  const newToken = invoked?.id === 'new' ? args.trim() : null;

  return { slash, plain: slash ? '' : raw.trim(), invoked, suggested, inArgs, newToken, unknown };
}

/* -------------------------------------------------------------------------- */
/* Collection names                                                            */
/* -------------------------------------------------------------------------- */

export type NamedCollection = {
  uid: string;
  displayName: string;
  apiID?: string;
  pluralName?: string;
};

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Every name a collection answers to after "/in": "order", "orders", "blog-post"… */
export function collectionAliases(c: NamedCollection): string[] {
  const names = [c.apiID, c.pluralName, slugify(c.displayName), c.uid.split('.').pop()];
  return Array.from(
    new Set(names.filter((n): n is string => Boolean(n)).map((n) => n.toLowerCase()))
  );
}

/** The name we write when completing with Tab. */
export function canonicalAlias(c: NamedCollection): string {
  return (c.apiID || slugify(c.displayName)).toLowerCase();
}

/** The collection whose name is exactly `token`, if any. */
export function resolveCollection<T extends NamedCollection>(
  token: string,
  collections: T[]
): T | undefined {
  const t = token.toLowerCase();
  return collections.find((c) => collectionAliases(c).includes(t));
}

/** Collections whose name starts with / contains `token`, best first. Empty token lists all. */
export function suggestCollections<T extends NamedCollection>(
  token: string,
  collections: T[]
): T[] {
  const t = token.toLowerCase();
  if (!t) return [...collections].sort((a, b) => a.displayName.localeCompare(b.displayName));

  const scored: { c: T; score: number }[] = [];
  for (const c of collections) {
    const names = [...collectionAliases(c), c.displayName.toLowerCase()];
    let best = Infinity;
    for (const n of names) {
      if (n === t) best = Math.min(best, 0);
      else if (n.startsWith(t)) best = Math.min(best, 1);
      else if (n.split(/[\s-]+/).some((w) => w.startsWith(t))) best = Math.min(best, 2);
      else if (n.includes(t)) best = Math.min(best, 3);
    }
    if (best !== Infinity) scored.push({ c, score: best });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.c.displayName.localeCompare(b.c.displayName))
    .map((s) => s.c);
}
