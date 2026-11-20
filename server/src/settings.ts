/** Settings shared by every admin of the project. Stored with Strapi's plugin store. */
export type StrapispotSettings = {
  /** Default shortcut, e.g. "Mod+Shift+K". "Mod" is Cmd on macOS and Ctrl elsewhere. */
  shortcut: string;
  /** Collections (by uid) that are left out of search. New collections are searchable by default. */
  excluded: string[];
  /** Which field is shown as the title, per collection uid. Missing = the Content Manager's own main field. */
  titleFields: Record<string, string>;
};

export const DEFAULT_SETTINGS: StrapispotSettings = {
  shortcut: 'Mod+Shift+K',
  excluded: [],
  titleFields: {},
};

const UID = /^[a-z][a-z0-9-]*::[A-Za-z0-9_.-]+$/;
const FIELD = /^[A-Za-z0-9_]{1,80}$/;
const SHORTCUT = /^[A-Za-z0-9+/\[\],.;'`=\- ]{1,40}$/;
const MAX_ITEMS = 1000;

/**
 * Turn anything (request body, stored value) into valid settings.
 * Unknown keys are dropped; bad values fall back to the defaults.
 */
export function sanitizeSettings(input: unknown): StrapispotSettings {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;

  const shortcut =
    typeof src.shortcut === 'string' && SHORTCUT.test(src.shortcut.trim())
      ? src.shortcut.trim()
      : DEFAULT_SETTINGS.shortcut;

  const excluded = Array.isArray(src.excluded)
    ? Array.from(
        new Set(src.excluded.filter((u): u is string => typeof u === 'string' && UID.test(u)))
      ).slice(0, MAX_ITEMS)
    : [];

  const titleFields: Record<string, string> = {};
  if (src.titleFields && typeof src.titleFields === 'object') {
    for (const [uid, field] of Object.entries(src.titleFields as Record<string, unknown>).slice(
      0,
      MAX_ITEMS
    )) {
      if (UID.test(uid) && typeof field === 'string' && FIELD.test(field)) titleFields[uid] = field;
    }
  }

  return { shortcut, excluded, titleFields };
}
