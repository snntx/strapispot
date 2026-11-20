import { getFetchClient } from '@strapi/strapi/admin';

import { makeSnippet, scoreResult, tokenize } from '../utils/rank';
import type { CollectionInfo } from './collections';

export type SearchResult = {
  key: string;
  uid: string;
  collection: string;
  documentId: string;
  title: string;
  /** A short piece of text showing why the entry matched, when the title does not. */
  snippet: string | null;
  status: 'draft' | 'published' | 'modified' | null;
  score: number;
  updatedAt: number;
};

export type SearchOutcome = {
  results: SearchResult[];
  /** Collections we could not search (usually: this admin may not read them). */
  skipped: { collection: string; reason: 'forbidden' | 'error' }[];
};

const PER_COLLECTION = 6;
const MAX_RESULTS = 24;
/** When searching inside a single collection we can show more. */
const SCOPED_LIMIT = 20;
/** At most this many collections are queried at once, so big projects do not flood the server. */
const CONCURRENCY = 6;

// Fields that never make a useful snippet.
const SKIP_FIELDS = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'locale',
  'status',
  'createdBy',
  'updatedBy',
  'localizations',
]);

/**
 * Search the given collections. With an empty `query` this lists the most
 * recently updated entries instead (used by "/in <collection>").
 */
export async function searchCollections(
  collections: CollectionInfo[],
  query: string,
  signal: AbortSignal
): Promise<SearchOutcome> {
  const scoped = collections.length === 1;
  const perCollection = scoped ? SCOPED_LIMIT : PER_COLLECTION;
  const maxResults = scoped ? SCOPED_LIMIT : MAX_RESULTS;
  const targets = collections.filter((c) => c.searchable);
  const skipped: SearchOutcome['skipped'] = [];
  const all: SearchResult[] = [];

  let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      const collection = targets[next++];
      try {
        all.push(...(await searchOne(collection, query, signal, perCollection)));
      } catch (error) {
        if (signal.aborted) throw error;
        const status =
          (error as { response?: { status?: number }; status?: number })?.response?.status ??
          (error as { status?: number })?.status;
        skipped.push({
          collection: collection.displayName,
          reason: status === 403 ? 'forbidden' : 'error',
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

  all.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
  return { results: all.slice(0, maxResults), skipped };
}

async function searchOne(
  collection: CollectionInfo,
  query: string,
  signal: AbortSignal,
  perCollection: number
): Promise<SearchResult[]> {
  const client = getFetchClient();
  const params = new URLSearchParams({
    page: '1',
    pageSize: String(perCollection),
    sort: 'updatedAt:desc',
  });
  if (query) params.set('_q', query);
  const { data } = await client.get<{ results?: Record<string, unknown>[] }>(
    `/content-manager/collection-types/${collection.uid}?${params.toString()}`,
    { signal }
  );
  const rows = data?.results ?? [];

  return rows.map((row) => {
    const rawTitle = row[collection.mainField];
    const title =
      typeof rawTitle === 'string' || typeof rawTitle === 'number'
        ? String(rawTitle)
        : String(row.documentId ?? '');

    const lowerTitle = title.toLowerCase();
    const titleHit = tokenize(query).some((t) => lowerTitle.includes(t));
    let snippet: string | null = null;
    if (query && !titleHit) {
      for (const [field, value] of Object.entries(row)) {
        if (SKIP_FIELDS.has(field) || field === collection.mainField) continue;
        if (typeof value !== 'string') continue;
        snippet = makeSnippet(value, query);
        if (snippet) break;
      }
    }

    const status = row.status;
    return {
      key: `${collection.uid}:${row.documentId}`,
      uid: collection.uid,
      collection: collection.displayName,
      documentId: String(row.documentId),
      title: title || '(untitled)',
      snippet,
      status: status === 'draft' || status === 'published' || status === 'modified' ? status : null,
      score: scoreResult(title, query, snippet !== null),
      updatedAt: Date.parse(String(row.updatedAt ?? '')) || 0,
    };
  });
}
