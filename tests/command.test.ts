import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalAlias,
  collectionAliases,
  parseInput,
  resolveCollection,
  suggestCollections,
} from '../admin/src/utils/command';
import { describeRelations, formatRelations } from '../admin/src/utils/relations';

const order = {
  uid: 'api::order.order',
  displayName: 'Order',
  apiID: 'order',
  pluralName: 'orders',
};
const blog = {
  uid: 'api::blog-post.blog-post',
  displayName: 'Blog Post',
  apiID: 'blog-post',
  pluralName: 'blog-posts',
};
const product = {
  uid: 'api::product.product',
  displayName: 'Product',
  apiID: 'product',
  pluralName: 'products',
};
const all = [product, order, blog];

test('plain text is an ordinary search', () => {
  const p = parseInput('  alice ');
  assert.equal(p.plain, 'alice');
  assert.equal(p.invoked, null);
  assert.equal(p.unknown, null);
});

test('"in" alone invokes the command with no collection yet', () => {
  const p = parseInput('in');
  assert.equal(p.invoked?.id, 'in');
  assert.deepEqual(p.inArgs, { token: '', tokenDone: false, text: '' });
  assert.equal(p.plain, 'in'); // ordinary results still run below the commands
});

test('"in ord" is a collection name being typed; "in order alice" has a scope and text', () => {
  assert.deepEqual(parseInput('in ord').inArgs, { token: 'ord', tokenDone: false, text: '' });
  assert.deepEqual(parseInput('in order alice smith').inArgs, {
    token: 'order',
    tokenDone: true,
    text: 'alice smith',
  });
  assert.deepEqual(parseInput('in order ').inArgs, { token: 'order', tokenDone: true, text: '' });
});

test('words that merely start with "in" are not the command', () => {
  assert.equal(parseInput('invoice').invoked, null);
  assert.equal(parseInput('in-stock items').invoked, null);
});

test('a leading slash means a command only: no ordinary search', () => {
  const p = parseInput('/in order x');
  assert.equal(p.slash, true);
  assert.equal(p.plain, '');
  assert.equal(p.inArgs?.token, 'order');
});

test('"/i" suggests commands; "/zzz" is unknown; "/" lists all commands', () => {
  assert.deepEqual(
    parseInput('/i').suggested.map((c) => c.id),
    ['in']
  );
  assert.equal(parseInput('/zzz').unknown, 'zzz');
  assert.equal(parseInput('/zzz foo').unknown, 'zzz');
  assert.equal(parseInput('/').suggested.length >= 2, true);
  assert.equal(parseInput('/n').suggested[0].id, 'new');
});

test('"new" takes everything after it as the collection name', () => {
  assert.equal(parseInput('new').invoked?.id, 'new');
  assert.equal(parseInput('new blog po').newToken, 'blog po');
  assert.equal(parseInput('new').newToken, '');
  assert.equal(parseInput('alice').newToken, null);
});

test('commands are case-insensitive', () => {
  assert.equal(parseInput('NEW').invoked?.id, 'new');
  assert.equal(parseInput('In Order').invoked?.id, 'in');
});

test('collection aliases include the API name, plural and a slug of the display name', () => {
  assert.deepEqual(collectionAliases(blog).sort(), ['blog-post', 'blog-posts'].sort());
  assert.equal(canonicalAlias(blog), 'blog-post');
  assert.equal(canonicalAlias({ uid: 'api::x.x', displayName: 'Fancy Name' }), 'fancy-name');
});

test('resolveCollection needs an exact name; plural works too', () => {
  assert.equal(resolveCollection('order', all), order);
  assert.equal(resolveCollection('ORDERS', all), order);
  assert.equal(resolveCollection('blog-post', all), blog);
  assert.equal(resolveCollection('ord', all), undefined);
});

test('suggestCollections puts exact and prefix matches first', () => {
  assert.equal(suggestCollections('', all).length, 3);
  // "o": Order starts with it; the others only contain it, so they come after, alphabetically.
  assert.deepEqual(
    suggestCollections('o', all).map((c) => c.displayName),
    ['Order', 'Blog Post', 'Product']
  );
  // "p": Product starts with it, Blog Post has a word starting with it, Order has none.
  assert.deepEqual(
    suggestCollections('p', all).map((c) => c.displayName),
    ['Product', 'Blog Post']
  );
  assert.deepEqual(
    suggestCollections('post', all).map((c) => c.displayName),
    ['Blog Post']
  );
  assert.deepEqual(suggestCollections('zzz', all), []);
});

test('describeRelations lists each related collection once and marks required / no access', () => {
  const full = [
    {
      ...order,
      relations: [
        { target: 'api::customer.customer', required: true },
        { target: 'api::product.product', required: false },
        { target: 'api::product.product', required: false },
        { target: 'plugin::hidden.thing', required: false },
      ],
    },
    { ...product, relations: [] },
    { uid: 'api::customer.customer', displayName: 'Customer', relations: [] },
  ];
  const rels = describeRelations(full[0], full, (uid) => uid !== 'api::product.product');
  assert.deepEqual(
    rels.map((r) => r.label),
    ['Customer', 'Product']
  );
  assert.equal(formatRelations(rels), '→ Customer (required), Product (no access)');
  assert.equal(formatRelations([]), 'No relations');
});
