import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FEED_URLS, loadConfig } from '../src/config.js';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  EMAIL_TO: 'me@example.com',
  EMAIL_FROM: 'alerts@example.com',
};

test('applies defaults', () => {
  const config = loadConfig(base);
  assert.equal(config.priorityThreshold, 4);
  assert.equal(config.maxScoredPerRun, 30);
  assert.equal(config.dryRun, false);
  assert.deepEqual(config.feedUrls, [...DEFAULT_FEED_URLS]);
});

test('requires DATABASE_URL', () => {
  assert.throws(() => loadConfig({ EMAIL_TO: 'a@b.c', EMAIL_FROM: 'd@e.f' }), /DATABASE_URL/);
});

test('requires email settings unless DRY_RUN is true', () => {
  assert.throws(() => loadConfig({ DATABASE_URL: base.DATABASE_URL }), /EMAIL_TO/);
  const config = loadConfig({ DATABASE_URL: base.DATABASE_URL, DRY_RUN: 'true' });
  assert.equal(config.dryRun, true);
  assert.equal(config.emailTo, '');
});

test('rejects an out-of-range priority threshold', () => {
  assert.throws(() => loadConfig({ ...base, PRIORITY_THRESHOLD: '6' }), /PRIORITY_THRESHOLD/);
});

test('splits a custom feed list', () => {
  const config = loadConfig({ ...base, FEED_URLS: 'https://a.example/rss, https://b.example/rss' });
  assert.deepEqual(config.feedUrls, ['https://a.example/rss', 'https://b.example/rss']);
});
