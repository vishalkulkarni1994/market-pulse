export type Direction = 'positive' | 'negative' | 'neutral' | 'unclear';
export type Priority = 1 | 2 | 3 | 4 | 5;

/** One entry read from an RSS feed, before it is stored. */
export interface FeedItem {
  /** Normalised URL (see feed/normalizeUrl.ts); this is the dedupe key. */
  url: string;
  title: string;
  description: string;
  publishedAt: Date | null;
  /** The feed URL this item came from. */
  feed: string;
}

/** A stored article. Database ids are converted to numbers by the store layer. */
export interface Article extends FeedItem {
  id: number;
  fetchedAt: Date;
}

/** What the scorer returns for one article. */
export interface ScoreResult {
  priority: Priority;
  direction: Direction;
  sectors: string[];
  reason: string;
  summary: string;
}

export interface Score extends ScoreResult {
  articleId: number;
  model: string;
}

export interface ScoredArticle {
  article: Article;
  score: Score;
}

/** Scores one article. The LLM provider sits behind this interface. */
export interface Scorer {
  readonly model: string;
  score(article: Article): Promise<ScoreResult>;
}

export interface Digest {
  subject: string;
  text: string;
  html: string;
}

export interface EmailMessage extends Digest {
  to: string;
  from: string;
}

/** Sends an email. The email provider sits behind this interface. */
export interface Mailer {
  send(message: EmailMessage): Promise<void>;
}
