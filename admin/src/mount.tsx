import { createRoot, type Root } from 'react-dom/client';
import { DesignSystemProvider, lightTheme, darkTheme } from '@strapi/design-system';

import { Palette } from './components/Palette';

const ROOT_ID = 'strapispot-root';
let root: Root | null = null;

/** Strapi stores the chosen theme as "light", "dark" or "system" under this key. */
function resolveTheme() {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem('STRAPI_THEME');
  } catch {
    // storage can be blocked; fall back to the system setting
  }
  const dark =
    stored === 'dark' ||
    (stored !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return dark ? darkTheme : lightTheme;
}

/**
 * Strapi has no app-wide mount point for plugins, so the palette lives in
 * its own React root appended to <body>. It is created once and never unmounted.
 */
export function mountPalette() {
  if (root || document.getElementById(ROOT_ID)) return;
  const host = document.createElement('div');
  host.id = ROOT_ID;
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(<ThemedPalette />);
}

import { useEffect, useState } from 'react';

function ThemedPalette() {
  const [theme, setTheme] = useState(resolveTheme);
  // Re-read the theme whenever the window regains focus or storage changes.
  useEffect(() => {
    const refresh = () => setTheme(resolveTheme());
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return (
    <DesignSystemProvider theme={theme}>
      <Palette onOpen={() => setTheme(resolveTheme())} />
    </DesignSystemProvider>
  );
}
