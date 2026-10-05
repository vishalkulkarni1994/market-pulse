import type { Config } from './config.js';
import type { Db } from './db.js';
import type { Mailer, Scorer } from './types.js';
import { fetchFeeds } from './feed/index.js';
import {
  createPendingDelivery,
  findUnscored,
  markDeliveryFailed,
  markDeliverySent,
  saveScore,
  selectDeliverable,
  storeNewArticles,
} from './store/index.js';
import { buildDigest } from './digest/index.js';

export interface JobDeps {
  config: Config;
  db: Db;
  scorer: Scorer;
  mailer: Mailer;
  log?: (message: string) => void;
}

export interface JobResult {
  fetched: number;
  added: number;
  scored: number;
  emailed: number;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * One hourly run: fetch, store, score, then email a digest if anything
 * qualifies. Steps hand work to each other through the database.
 */
export async function runJob(deps: JobDeps): Promise<JobResult> {
  const { config, db, scorer, mailer } = deps;
  const log = deps.log ?? console.log;

  // 1. Fetch feeds and store only articles not seen before.
  const items = await fetchFeeds(config.feedUrls);
  const added = await storeNewArticles(db, items);
  log(`fetched ${items.length} items, ${added} new`);

  // 2. Score articles that have no score yet. A failure leaves the article
  //    unscored, so the next run retries it.
  const unscored = await findUnscored(db, config.maxScoredPerRun);
  let scored = 0;
  for (const article of unscored) {
    try {
      const result = await scorer.score(article);
      await saveScore(db, { ...result, articleId: article.id, model: scorer.model });
      scored += 1;
    } catch (err) {
      log(`scoring failed for ${article.url}: ${errorMessage(err)}`);
    }
  }

  // 3. Email high-priority articles that have not been sent yet.
  const deliverable = await selectDeliverable(db, config.priorityThreshold);
  if (deliverable.length === 0) {
    log('nothing to send');
    return { fetched: items.length, added, scored, emailed: 0 };
  }

  const digest = buildDigest(deliverable);
  // Record the delivery first, then send, then mark it sent.
  const deliveryId = await createPendingDelivery(
    db,
    config.emailTo,
    deliverable.map((d) => d.article.id),
  );
  try {
    await mailer.send({ to: config.emailTo, from: config.emailFrom, ...digest });
    await markDeliverySent(db, deliveryId);
  } catch (err) {
    await markDeliveryFailed(db, deliveryId);
    throw err;
  }

  return { fetched: items.length, added, scored, emailed: deliverable.length };
}
