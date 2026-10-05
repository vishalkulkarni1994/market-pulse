import type { FeedItem } from '../types.js';

export { normalizeUrl } from './normalizeUrl.js';

/**
 * TODO: download each RSS feed, parse the items, and return them with
 * normalised URLs. A feed that fails should be logged and skipped, not abort
 * the whole run.
 */
export async function fetchFeeds(feedUrls: readonly string[]): Promise<FeedItem[]> {
  void feedUrls;
  throw new Error('not implemented: fetchFeeds');
}
