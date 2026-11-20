import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  captureShortcut,
  formatShortcut,
  keyOf,
  matchesShortcut,
  parseShortcut,
} from '../admin/src/utils/shortcut';

const press = (init: Partial<KeyboardEvent> & { key: string }) => ({
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...init,
});

test('parseShortcut reads modifiers and key', () => {
  assert.deepEqual(parseShortcut('Mod+Shift+K'), { mod: true, shift: true, alt: false, key: 'k' });
  assert.deepEqual(parseShortcut('ctrl+alt+/'), { mod: true, shift: false, alt: true, key: '/' });
});

test('parseShortcut rejects empty input, no key, and two keys', () => {
  assert.equal(parseShortcut(''), null);
  assert.equal(parseShortcut('Mod+Shift'), null);
  assert.equal(parseShortcut('Mod+K+J'), null);
});

test('Mod means Cmd on a Mac and Ctrl elsewhere', () => {
  const s = parseShortcut('Mod+Shift+K')!;
  assert.equal(matchesShortcut(press({ key: 'K', metaKey: true, shiftKey: true }), s, true), true);
  assert.equal(matchesShortcut(press({ key: 'K', ctrlKey: true, shiftKey: true }), s, true), false);
  assert.equal(matchesShortcut(press({ key: 'K', ctrlKey: true, shiftKey: true }), s, false), true);
  assert.equal(
    matchesShortcut(press({ key: 'K', metaKey: true, shiftKey: true }), s, false),
    false
  );
});

test('matchesShortcut needs the exact modifiers', () => {
  const s = parseShortcut('Mod+K')!;
  assert.equal(matchesShortcut(press({ key: 'k', ctrlKey: true }), s, false), true);
  assert.equal(
    matchesShortcut(press({ key: 'k', ctrlKey: true, shiftKey: true }), s, false),
    false
  );
  assert.equal(matchesShortcut(press({ key: 'k', ctrlKey: true, altKey: true }), s, false), false);
  assert.equal(matchesShortcut(press({ key: 'k' }), s, false), false);
});

test('letters are read from the physical key, so Alt on a Mac still works', () => {
  // On a Mac, Option+J types "∆": `key` is not the letter, `code` is.
  const event = press({ key: '∆', code: 'KeyJ', altKey: true, metaKey: true });
  assert.equal(keyOf(event), 'j');
  assert.equal(matchesShortcut(event, parseShortcut('Mod+Alt+J')!, true), true);
});

test('formatShortcut uses symbols on a Mac and words elsewhere', () => {
  const s = parseShortcut('Mod+Shift+K')!;
  assert.equal(formatShortcut(s, true), '⌘⇧K');
  assert.equal(formatShortcut(s, false), 'Ctrl+Shift+K');
});

test('captureShortcut turns a key press into a shortcut string', () => {
  assert.equal(
    captureShortcut(press({ key: 'K', code: 'KeyK', metaKey: true, shiftKey: true }), true),
    'Mod+Shift+K'
  );
  assert.equal(
    captureShortcut(press({ key: 'j', code: 'KeyJ', ctrlKey: true, altKey: true }), false),
    'Mod+Alt+J'
  );
});

test('captureShortcut refuses plain keys and lone modifiers', () => {
  assert.equal(captureShortcut(press({ key: 'k', code: 'KeyK' }), false), null);
  assert.equal(captureShortcut(press({ key: 'Shift', shiftKey: true }), false), null);
  assert.equal(captureShortcut(press({ key: 'Meta', metaKey: true }), true), null);
  // Shift alone is not enough: it would hijack capital letters.
  assert.equal(captureShortcut(press({ key: 'K', code: 'KeyK', shiftKey: true }), false), null);
});

test('a captured shortcut can be parsed and matched again', () => {
  const event = press({ key: 'k', code: 'KeyK', ctrlKey: true, shiftKey: true });
  const text = captureShortcut(event, false)!;
  assert.equal(matchesShortcut(event, parseShortcut(text)!, false), true);
});
