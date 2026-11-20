/**
 * Where the admin panel lives, e.g. "/admin". Strapi replaces
 * `process.env.ADMIN_PATH` when it bundles the admin; if that did not happen
 * we fall back to the default.
 */
export function getAdminBase(): string {
  let base = '';
  try {
    base = (process.env.ADMIN_PATH ?? '').replace(window.location.origin, '');
  } catch {
    // `process` does not exist in the browser unless Strapi's bundler defined it
  }
  base = base.replace(/\/+$/, '');
  return base || '/admin';
}

export function entryPath(uid: string, documentId: string): string {
  return `${getAdminBase()}/content-manager/collection-types/${uid}/${documentId}`;
}

export function createPath(uid: string): string {
  return `${getAdminBase()}/content-manager/collection-types/${uid}/create`;
}

/** Go to an admin URL without a page reload (Strapi's router listens for popstate). */
export function goTo(path: string): void {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
