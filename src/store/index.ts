import type { Db } from '../db.js';
import type { Article, FeedItem, Score, ScoredArticle } from '../types.js';

// All database access lives here. Every function below is still a stub.

/** TODO: insert items that are new (ON CONFLICT (url) DO NOTHING); return how many were added. */
export async function storeNewArticles(db: Db, items: readonly FeedItem[]): Promise<number> {
  void db;
  void items;
  throw new Error('not implemented: storeNewArticles');
}

/** TODO: articles with no row in scores, oldest first, at most `limit`. */
export async function findUnscored(db: Db, limit: number): Promise<Article[]> {
  void db;
  void limit;
  throw new Error('not implemented: findUnscored');
}

/** TODO: insert one row into scores. */
export async function saveScore(db: Db, score: Score): Promise<void> {
  void db;
  void score;
  throw new Error('not implemented: saveScore');
}

/** TODO: scored articles with priority >= threshold that are not in delivery_items yet. */
export async function selectDeliverable(db: Db, threshold: number): Promise<ScoredArticle[]> {
  void db;
  void threshold;
  throw new Error('not implemented: selectDeliverable');
}

/**
 * TODO: in one transaction, insert a 'pending' delivery and its delivery_items.
 * The UNIQUE constraint on delivery_items.article_id stops an article being sent twice.
 */
export async function createPendingDelivery(
  db: Db,
  recipient: string,
  articleIds: readonly number[],
): Promise<number> {
  void db;
  void recipient;
  void articleIds;
  throw new Error('not implemented: createPendingDelivery');
}

/** TODO: set status = 'sent' and sent_at = now(). */
export async function markDeliverySent(db: Db, deliveryId: number): Promise<void> {
  void db;
  void deliveryId;
  throw new Error('not implemented: markDeliverySent');
}

/** TODO: set status = 'failed' and delete its delivery_items so the articles are eligible again. */
export async function markDeliveryFailed(db: Db, deliveryId: number): Promise<void> {
  void db;
  void deliveryId;
  throw new Error('not implemented: markDeliveryFailed');
}
