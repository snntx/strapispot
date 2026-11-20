import { test } from 'node:test';
import assert from 'node:assert/strict';

import { highlightSegments } from '../admin/src/utils/highlight';
import { makeSnippet, scoreResult, scoreTitle, tokenize } from '../admin/src/utils/rank';

test('tokenize lower-cases and splits on whitespace', () => {
  assert.deepEqual(tokenize('  Blue   Shirt '), ['blue', 'shirt']);
  assert.deepEqual(tokenize(''), []);
});

test('scoreTitle ranks exact > prefix > word start > contains > all words', () => {
  assert.equal(scoreTitle('Keyboard', 'keyboard'), 100);
  assert.equal(scoreTitle('Keyboards', 'keyboard'), 80);
  assert.equal(scoreTitle('Wireless Keyboard', 'keyboard'), 60);
  assert.equal(scoreTitle('Superkeyboard', 'keyboard'), 40);
  assert.equal(scoreTitle('Keyboard, wireless', 'wireless keyboard'), 30);
  assert.equal(scoreTitle('Monitor', 'keyboard'), 0);
});

test('scoreTitle is safe with characters that mean something in a regular expression', () => {
  assert.equal(scoreTitle('Price (USD)', '(usd'), 60);
  assert.equal(scoreTitle('a+b', 'a+b'), 100);
  assert.doesNotThrow(() => scoreTitle('anything', '[.*+?^${}()|\\'));
});

test('scoreResult: a title match beats a match elsewhere, and shorter titles win ties', () => {
  const inTitle = scoreResult('Keyboard', 'key', false);
  const elsewhere = scoreResult('Monitor', 'key', true);
  const noClue = scoreResult('Monitor', 'key', false);
  assert.ok(inTitle > elsewhere && elsewhere > noClue);
  assert.ok(
    scoreResult('Keyboard', 'key', false) >
      scoreResult('Keyboard with a very long name', 'key', false)
  );
});

test('makeSnippet shows text around the first match', () => {
  const text =
    'A very long description that eventually mentions the word London somewhere in the middle of it all.';
  const snippet = makeSnippet(text, 'london')!;
  assert.ok(snippet.toLowerCase().includes('london'));
  assert.ok(snippet.startsWith('…'));
  assert.equal(makeSnippet('nothing here', 'london'), null);
});

test('highlightSegments marks every match and keeps the original text', () => {
  const segs = highlightSegments('Wireless Keyboard', 'key wire');
  assert.equal(segs.map((s) => s.text).join(''), 'Wireless Keyboard');
  assert.deepEqual(
    segs.filter((s) => s.match).map((s) => s.text),
    ['Wire', 'Key']
  );
});

test('highlightSegments handles no query, no match, and special characters', () => {
  assert.deepEqual(highlightSegments('abc', ''), [{ text: 'abc', match: false }]);
  assert.deepEqual(highlightSegments('abc', 'zzz'), [{ text: 'abc', match: false }]);
  assert.deepEqual(highlightSegments('a.b', '.'), [
    { text: 'a', match: false },
    { text: '.', match: true },
    { text: 'b', match: false },
  ]);
});

test('highlightSegments returns plain text, never markup', () => {
  const segs = highlightSegments('<b>x</b>', 'x');
  assert.equal(segs.map((s) => s.text).join(''), '<b>x</b>');
});
