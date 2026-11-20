import { getFetchClient } from '@strapi/strapi/admin';

import { DEFAULT_SHORTCUT } from '../utils/shortcut';

/** Same shape as the server's settings (server/src/settings.ts). */
export type Settings = {
  shortcut: string;
  excluded: string[];
  titleFields: Record<string, string>;
};

export const DEFAULT_SETTINGS: Settings = {
  shortcut: DEFAULT_SHORTCUT,
  excluded: [],
  titleFields: {},
};

/** Fired on `window` after settings were saved, so the palette reloads them. */
export const SETTINGS_EVENT = 'strapispot:settings-changed';

const LOCAL_SHORTCUT_KEY = 'strapispot:shortcut';
const CACHE_MS = 30_000;

let cache: { at: number; value: Promise<Settings> } | null = null;

export function clearSettingsCache() {
  cache = null;
}

export function loadSettings(signal?: AbortSignal): Promise<Settings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const value = getFetchClient()
    .get<{ data: Partial<Settings> }>('/strapispot/settings', { signal })
    .then(({ data }) => ({ ...DEFAULT_SETTINGS, ...(data?.data ?? {}) }) as Settings)
    .catch((error) => {
      cache = null;
      throw error;
    });
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const { data } = await getFetchClient().put<{ data: Settings }>('/strapispot/settings', settings);
  clearSettingsCache();
  window.dispatchEvent(new Event(SETTINGS_EVENT));
  return { ...DEFAULT_SETTINGS, ...data.data };
}

/** A shortcut chosen for this browser only (for example because of a clash with the browser's own keys). */
export function getLocalShortcut(): string | null {
  try {
    return window.localStorage.getItem(LOCAL_SHORTCUT_KEY);
  } catch {
    return null;
  }
}

export function setLocalShortcut(value: string | null) {
  try {
    if (value) window.localStorage.setItem(LOCAL_SHORTCUT_KEY, value);
    else window.localStorage.removeItem(LOCAL_SHORTCUT_KEY);
  } catch {
    // storage blocked: the setting simply does not stick
  }
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}
