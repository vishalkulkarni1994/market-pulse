import type { Digest, ScoredArticle } from '../types.js';

/**
 * TODO: build the hourly email. For each article show the headline (linked to
 * the original), priority, direction, affected sectors and the reason. Provide
 * plain text and simple HTML, and add the "not investment advice" line.
 */
export function buildDigest(items: readonly ScoredArticle[]): Digest {
  void items;
  throw new Error('not implemented: buildDigest');
}
