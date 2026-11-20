/**
 * Shortcut strings look like "Mod+Shift+K".
 * "Mod" means Cmd on macOS and Ctrl everywhere else.
 */
export const DEFAULT_SHORTCUT = 'Mod+Shift+K';

export type ParsedShortcut = {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string; // lower-case, e.g. "k" or "/"
};

export function parseShortcut(input: string): ParsedShortcut | null {
  const parts = input
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const parsed: ParsedShortcut = { mod: false, shift: false, alt: false, key: '' };
  for (const part of parts) {
    const p = part.toLowerCase();
    if (p === 'mod' || p === 'cmd' || p === 'ctrl' || p === 'control') parsed.mod = true;
    else if (p === 'shift') parsed.shift = true;
    else if (p === 'alt' || p === 'option') parsed.alt = true;
    else if (parsed.key === '') parsed.key = p;
    else return null; // two non-modifier keys is not supported
  }
  return parsed.key === '' ? null : parsed;
}

export function isMac(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
  );
}

type KeyLike = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'> & {
  code?: string;
};

/**
 * The key as a lower-case name. Letters and digits come from the physical key
 * (`code`), because with Alt held on a Mac `key` is a symbol, not the letter.
 */
export function keyOf(event: KeyLike): string {
  const code = event.code ?? '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (event.key === ' ') return 'space';
  return event.key.toLowerCase();
}

export function matchesShortcut(event: KeyLike, shortcut: ParsedShortcut, mac = isMac()): boolean {
  const modDown = mac ? event.metaKey : event.ctrlKey;
  // The other "mod-like" key must not be held, so Ctrl+K does not fire on a Mac.
  const strayMod = mac ? event.ctrlKey : event.metaKey;
  return (
    modDown === shortcut.mod &&
    !strayMod &&
    event.shiftKey === shortcut.shift &&
    event.altKey === shortcut.alt &&
    keyOf(event) === shortcut.key
  );
}

export function formatShortcut(shortcut: ParsedShortcut, mac = isMac()): string {
  const out: string[] = [];
  if (shortcut.mod) out.push(mac ? '⌘' : 'Ctrl');
  if (shortcut.alt) out.push(mac ? '⌥' : 'Alt');
  if (shortcut.shift) out.push(mac ? '⇧' : 'Shift');
  out.push(shortcut.key.toUpperCase());
  return mac ? out.join('') : out.join('+');
}

const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta', 'altgraph', 'os']);

/**
 * Turn a key press into a shortcut string such as "Mod+Shift+K", for the settings screen.
 * Returns null while only modifiers are held, or when the combination is not allowed
 * (it needs Cmd/Ctrl or Alt, so plain typing is never hijacked).
 */
export function captureShortcut(event: KeyLike, mac = isMac()): string | null {
  const key = keyOf(event);
  if (MODIFIER_KEYS.has(key) || key === '+' || key === 'dead' || key === 'unidentified')
    return null;
  const mod = mac ? event.metaKey : event.ctrlKey;
  if (!mod && !event.altKey) return null;
  const parts: string[] = [];
  if (mod) parts.push('Mod');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join('+');
}
