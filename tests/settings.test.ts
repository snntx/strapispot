import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_SETTINGS, sanitizeSettings } from '../server/src/settings';

test('nothing or nonsense gives the defaults', () => {
  assert.deepEqual(sanitizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings('hello'), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings({}), DEFAULT_SETTINGS);
});

test('a valid shortcut is kept (trimmed); an invalid one falls back', () => {
  assert.equal(sanitizeSettings({ shortcut: '  Mod+Alt+J ' }).shortcut, 'Mod+Alt+J');
  assert.equal(
    sanitizeSettings({ shortcut: '<script>alert(1)</script>' }).shortcut,
    DEFAULT_SETTINGS.shortcut
  );
  assert.equal(sanitizeSettings({ shortcut: '' }).shortcut, DEFAULT_SETTINGS.shortcut);
  assert.equal(sanitizeSettings({ shortcut: 42 }).shortcut, DEFAULT_SETTINGS.shortcut);
  assert.equal(sanitizeSettings({ shortcut: 'x'.repeat(100) }).shortcut, DEFAULT_SETTINGS.shortcut);
});

test('excluded keeps only valid collection uids, once each', () => {
  const out = sanitizeSettings({
    excluded: [
      'api::order.order',
      'api::order.order',
      'nonsense',
      5,
      '../etc',
      'plugin::upload.file',
    ],
  });
  assert.deepEqual(out.excluded, ['api::order.order', 'plugin::upload.file']);
  assert.deepEqual(sanitizeSettings({ excluded: 'api::order.order' }).excluded, []);
});

test('titleFields keeps only valid uid → field pairs', () => {
  const out = sanitizeSettings({
    titleFields: {
      'api::product.product': 'sku',
      'api::order.order': 'bad field!',
      nonsense: 'name',
      'api::customer.customer': 12,
    },
  });
  assert.deepEqual(out.titleFields, { 'api::product.product': 'sku' });
});

test('unknown keys are dropped and the lists are capped', () => {
  const out = sanitizeSettings({
    shortcut: 'Mod+K',
    evil: true,
    excluded: Array.from({ length: 5000 }, (_, i) => `api::a${i}.a${i}`),
  });
  assert.deepEqual(Object.keys(out).sort(), ['excluded', 'shortcut', 'titleFields']);
  assert.equal(out.excluded.length, 1000);
});

test('sanitizing is stable: cleaning clean settings changes nothing', () => {
  const once = sanitizeSettings({
    shortcut: 'Mod+Alt+J',
    excluded: ['api::a.a'],
    titleFields: { 'api::a.a': 'title' },
  });
  assert.deepEqual(sanitizeSettings(once), once);
});
