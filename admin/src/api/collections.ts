import { getFetchClient } from '@strapi/strapi/admin';

/**
 * NOTE: these Content Manager routes are what Strapi's own admin screens use,
 * but they are NOT part of Strapi's documented plugin API. They may change
 * between Strapi versions, so everything that touches their shape lives here.
 */

export type RelationInfo = {
  attribute: string;
  relation: string;
  target: string;
  required: boolean;
};

export type CollectionInfo = {
  uid: string;
  displayName: string;
  /** Short API names, used after "/in" (e.g. "order", "orders"). */
  apiID: string;
  pluralName?: string;
  /** The field shown as the entry's title: the Content Manager's main field, unless settings say otherwise. */
  mainField: string;
  /** The Content Manager's own main field for this collection. */
  defaultMainField: string;
  /** Fields that make sense as a title (text, number, enumeration...). */
  titleFields: string[];
  searchable: boolean;
  hasDraftAndPublish: boolean;
  relations: RelationInfo[];
};

type RawAttribute = { type: string; relation?: string; target?: string; required?: boolean };
type RawContentType = {
  uid: string;
  isDisplayed: boolean;
  kind: 'collectionType' | 'singleType';
  apiID?: string;
  info: { displayName: string; pluralName?: string };
  options?: { draftAndPublish?: boolean };
  attributes: Record<string, RawAttribute>;
};

const CACHE_MS = 60_000;

/** Attribute types whose value is short text or a number, so it can serve as a title. */
const TITLE_TYPES = new Set([
  'string',
  'text',
  'email',
  'uid',
  'enumeration',
  'integer',
  'biginteger',
  'decimal',
  'float',
  'date',
  'datetime',
]);
let cache: { at: number; value: Promise<CollectionInfo[]> } | null = null;

/** Forget cached collections (e.g. after content types change). */
export function clearCollectionsCache() {
  cache = null;
}

/** All collection types that show up in the Content Manager, with their title field. */
export function loadCollections(signal?: AbortSignal): Promise<CollectionInfo[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = fetchCollections(signal).catch((error) => {
    cache = null; // do not cache failures
    throw error;
  });
  cache = { at: Date.now(), value };
  return value;
}

async function fetchCollections(signal?: AbortSignal): Promise<CollectionInfo[]> {
  const client = getFetchClient();
  const { data } = await client.get<{ data: RawContentType[] }>('/content-manager/content-types', {
    signal,
  });
  const types = data?.data ?? [];
  const visible = types.filter((t) => t.kind === 'collectionType' && t.isDisplayed);

  const collections = await Promise.all(
    visible.map(async (t): Promise<CollectionInfo> => {
      let mainField = 'documentId';
      let searchable = true;
      try {
        const res = await client.get<{
          data?: { contentType?: { settings?: { mainField?: string; searchable?: boolean } } };
        }>(`/content-manager/content-types/${t.uid}/configuration`, { signal });
        const settings = res.data?.data?.contentType?.settings;
        if (settings?.mainField) mainField = settings.mainField;
        if (settings?.searchable === false) searchable = false;
      } catch {
        // no permission to read the view configuration: keep the safe defaults
      }
      const relations = Object.entries(t.attributes)
        .filter(([, a]) => a.type === 'relation' && a.target && !a.target.startsWith('admin::'))
        .map(([attribute, a]) => ({
          attribute,
          relation: a.relation as string,
          target: a.target as string,
          required: Boolean(a.required),
        }));
      return {
        uid: t.uid,
        displayName: t.info.displayName,
        apiID: t.apiID ?? t.uid.split('.').pop() ?? t.uid,
        pluralName: t.info.pluralName,
        mainField,
        defaultMainField: mainField,
        titleFields: Object.entries(t.attributes)
          .filter(
            ([name, a]) =>
              TITLE_TYPES.has(a.type) &&
              !['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'locale'].includes(
                name
              )
          )
          .map(([name]) => name),
        searchable,
        hasDraftAndPublish: Boolean(t.options?.draftAndPublish),
        relations,
      };
    })
  );

  return collections.sort((a, b) => a.displayName.localeCompare(b.displayName));
}
