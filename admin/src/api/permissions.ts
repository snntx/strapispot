import { getFetchClient } from '@strapi/strapi/admin';

/**
 * NOTE: `/admin/users/me/permissions` is what Strapi's own admin uses to know
 * what the logged-in admin may do. It is NOT part of the documented plugin API
 * and may change between Strapi versions, so it is used in this one file only.
 * If the call fails we return `null` and the palette stops greying things out;
 * the server still refuses anything the admin is not allowed to do.
 */

type RawPermission = { action: string; subject: string | null };

export type PermissionSet = {
  canRead(uid: string): boolean;
  canCreate(uid: string): boolean;
};

const READ = 'plugin::content-manager.explorer.read';
const CREATE = 'plugin::content-manager.explorer.create';
const CACHE_MS = 30_000;

let cache: { at: number; value: Promise<PermissionSet> } | null = null;

export function clearPermissionsCache() {
  cache = null;
}

export function loadPermissions(signal?: AbortSignal): Promise<PermissionSet> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = fetchPermissions(signal).catch((error) => {
    cache = null;
    throw error;
  });
  cache = { at: Date.now(), value };
  return value;
}

async function fetchPermissions(signal?: AbortSignal): Promise<PermissionSet> {
  const { data } = await getFetchClient().get<{ data: RawPermission[] }>(
    '/admin/users/me/permissions',
    { signal }
  );
  const list = data?.data ?? [];
  // A permission that carries conditions (e.g. "only own entries") still counts as allowed:
  // the server applies the condition when the action actually happens.
  const has = (action: string) =>
    new Set(list.filter((p) => p.action === action && p.subject).map((p) => p.subject as string));
  const readable = has(READ);
  const creatable = has(CREATE);
  return {
    canRead: (uid) => readable.has(uid),
    canCreate: (uid) => creatable.has(uid),
  };
}
