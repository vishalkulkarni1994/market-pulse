import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeUrl } from '../src/feed/normalizeUrl.js';

const CANONICAL =
  'https://www.business-standard.com/economy/news/india-us-have-reached-a-plateau-in-trade-talks-says-fm-nirmala-sitharaman-126100500184_1.html';

test('removes a leading /amp path segment', () => {
  const amp =
    'https://www.business-standard.com/amp/economy/news/india-us-have-reached-a-plateau-in-trade-talks-says-fm-nirmala-sitharaman-126100500184_1.html';
  assert.equal(normalizeUrl(amp), CANONICAL);
});

test('leaves a non-AMP URL unchanged', () => {
  assert.equal(normalizeUrl(CANONICAL), CANONICAL);
});

test('drops query string and fragment', () => {
  assert.equal(normalizeUrl(`${CANONICAL}?utm_source=rss#top`), CANONICAL);
});

test('lowercases the host', () => {
  assert.equal(
    normalizeUrl('https://WWW.Business-Standard.com/economy/news/a.html'),
    'https://www.business-standard.com/economy/news/a.html',
  );
});

test('removes a trailing slash', () => {
  assert.equal(
    normalizeUrl('https://www.business-standard.com/economy/news/'),
    'https://www.business-standard.com/economy/news',
  );
});

test('does not strip paths that merely start with "amp"', () => {
  assert.equal(
    normalizeUrl('https://www.business-standard.com/ampersand/story'),
    'https://www.business-standard.com/ampersand/story',
  );
});

test('rejects text that is not a URL', () => {
  assert.throws(() => normalizeUrl('not a url'));
});
